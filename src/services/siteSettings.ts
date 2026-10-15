import { ServiceFailure } from "./applicationErrors.ts";
import { doc, getDoc, getDocFromServer, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "../firebase";
import { normaliseParentConsentEnabled, normaliseParentLoginEnabled } from "../security/parentLoginVisibility";

export type SessionSettings = {
    parentInactivityMinutes: number;
    leaderDesktopInactivityMinutes: number;
    leaderPhoneInactivityMinutes: number;
};

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
    parentInactivityMinutes: 20,
    leaderDesktopInactivityMinutes: 20,
    leaderPhoneInactivityMinutes: 90
};

const SETTINGS_REF = doc(db, "siteSettings", "session");
const PARENT_LOGIN_SETTINGS_REF = doc(db, "siteSettings", "parentLogin");
const PARENT_CONSENT_SETTINGS_REF = doc(db, "siteSettings", "parentConsent");
const PUBLIC_NAVIGATION_SETTINGS_REF = doc(db, "siteSettings", "publicNavigation");
const MIN_TIMEOUT_MINUTES = 5;
const MAX_TIMEOUT_MINUTES = 240;

export { DEFAULT_PARENT_LOGIN_ENABLED, normaliseParentLoginEnabled } from "../security/parentLoginVisibility";
export { DEFAULT_PARENT_CONSENT_ENABLED, normaliseParentConsentEnabled } from "../security/parentLoginVisibility";

function validMinutes(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) && value >= MIN_TIMEOUT_MINUTES && value <= MAX_TIMEOUT_MINUTES
        ? Math.round(value)
        : fallback;
}

export function normaliseSessionSettings(data: Record<string, unknown> | null | undefined): SessionSettings {
    return {
        parentInactivityMinutes: validMinutes(data?.parentInactivityMinutes, DEFAULT_SESSION_SETTINGS.parentInactivityMinutes),
        leaderDesktopInactivityMinutes: validMinutes(data?.leaderDesktopInactivityMinutes, DEFAULT_SESSION_SETTINGS.leaderDesktopInactivityMinutes),
        leaderPhoneInactivityMinutes: validMinutes(data?.leaderPhoneInactivityMinutes, DEFAULT_SESSION_SETTINGS.leaderPhoneInactivityMinutes)
    };
}

export async function loadSessionSettings(): Promise<SessionSettings> {
    const snapshot = await getDoc(SETTINGS_REF);
    return snapshot.exists()
        ? normaliseSessionSettings(snapshot.data())
        : DEFAULT_SESSION_SETTINGS;
}

export async function saveSessionSettings(settings: SessionSettings): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("You must be signed in to change site settings.", "auth/unauthenticated");

    const normalised = normaliseSessionSettings(settings);
    if (
        normalised.parentInactivityMinutes !== settings.parentInactivityMinutes ||
        normalised.leaderDesktopInactivityMinutes !== settings.leaderDesktopInactivityMinutes ||
        normalised.leaderPhoneInactivityMinutes !== settings.leaderPhoneInactivityMinutes
    ) {
        throw new Error(`Session timeouts must be whole minutes between ${MIN_TIMEOUT_MINUTES} and ${MAX_TIMEOUT_MINUTES}.`);
    }

    await setDoc(SETTINGS_REF, {
        ...normalised,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
    }, { merge: true });
}

/** Public navigation reads only this non-sensitive projection, never privileged site settings. */
export async function loadPublicParentLoginEnabled(): Promise<boolean> {
    const snapshot = await getDocFromServer(PUBLIC_NAVIGATION_SETTINGS_REF);
    return normaliseParentLoginEnabled(snapshot.data(), snapshot.exists());
}

/** The canonical setting is readable only by Super Admin; Firestore Rules enforce writes. */
export async function loadParentLoginEnabled(): Promise<boolean> {
    const [canonical, projection] = await Promise.all([
        getDocFromServer(PARENT_LOGIN_SETTINGS_REF),
        getDocFromServer(PUBLIC_NAVIGATION_SETTINGS_REF)
    ]);
    if (canonical.exists() !== projection.exists()) {
        throw new ServiceFailure("Parent Login settings are out of sync. Reload the page or contact a Super Admin.", "firestore/failed-precondition");
    }
    const canonicalEnabled = normaliseParentLoginEnabled(canonical.data(), canonical.exists());
    const projectedEnabled = normaliseParentLoginEnabled(projection.data(), projection.exists());
    if (canonicalEnabled !== projectedEnabled) {
        throw new ServiceFailure("Parent Login settings are out of sync. Reload the page or contact a Super Admin.", "firestore/failed-precondition");
    }
    return canonicalEnabled;
}

/** Compare-and-set both the private setting and public navigation projection atomically. */
export async function saveParentLoginEnabled(enabled: boolean, expectedEnabled: boolean): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("You must be signed in as a Super Admin to change Parent Login visibility.", "auth/unauthenticated");
    if (typeof enabled !== "boolean" || typeof expectedEnabled !== "boolean") {
        throw new ServiceFailure("Choose whether public Parent Login should be enabled.", "app/invalid-argument");
    }

    await runTransaction(db, async (transaction) => {
        const [canonical, projection, consentCanonical] = await Promise.all([
            transaction.get(PARENT_LOGIN_SETTINGS_REF),
            transaction.get(PUBLIC_NAVIGATION_SETTINGS_REF),
            transaction.get(PARENT_CONSENT_SETTINGS_REF)
        ]);
        const current = normaliseParentLoginEnabled(canonical.data(), canonical.exists());
        const projected = normaliseParentLoginEnabled(projection.data(), projection.exists());
        const consentProjectionPresent = Object.hasOwn(projection.data() || {}, "parentConsentEnabled");
        const consentCanonicalEnabled = normaliseParentConsentEnabled(consentCanonical.data());
        const consentProjectedEnabled = normaliseParentConsentEnabled(projection.data());
        if (current !== projected) {
            throw new ServiceFailure("Parent Login settings are out of sync. Reload the page and try again.", "firestore/failed-precondition");
        }
        if (consentCanonical.exists() !== consentProjectionPresent || consentCanonicalEnabled !== consentProjectedEnabled) {
            throw new ServiceFailure("Parent Portal consent settings are out of sync. Reload settings and try again.", "firestore/failed-precondition");
        }
        if (current !== expectedEnabled) {
            throw new ServiceFailure("Parent Login was changed in another session. Reload settings before trying again.", "firestore/aborted");
        }

        const audit = { updatedAt: serverTimestamp(), updatedBy: user.uid };
        transaction.set(PARENT_LOGIN_SETTINGS_REF, { parentLoginEnabled: enabled, ...audit });
        transaction.set(PUBLIC_NAVIGATION_SETTINGS_REF, {
            parentLoginEnabled: enabled,
            ...(consentCanonical.exists() ? { parentConsentEnabled: consentCanonicalEnabled } : {})
        });
    });
}

/** Parents read only the non-sensitive public projection; unset consent settings fail closed. */
export async function loadParentConsentEnabled(): Promise<boolean> {
    const snapshot = await getDocFromServer(PUBLIC_NAVIGATION_SETTINGS_REF);
    return normaliseParentConsentEnabled(snapshot.data());
}

/** Compare-and-set the private consent setting and its public, non-sensitive projection atomically. */
export async function saveParentConsentEnabled(enabled: boolean, expectedEnabled: boolean): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("You must be signed in as a Super Admin to change Parent Portal consent settings.", "auth/unauthenticated");
    if (typeof enabled !== "boolean" || typeof expectedEnabled !== "boolean") {
        throw new ServiceFailure("Choose whether Parent Portal Consent and Medical Consent should be enabled.", "app/invalid-argument");
    }

    await runTransaction(db, async (transaction) => {
        const [canonical, projection] = await Promise.all([
            transaction.get(PARENT_CONSENT_SETTINGS_REF),
            transaction.get(PUBLIC_NAVIGATION_SETTINGS_REF)
        ]);
        const current = normaliseParentConsentEnabled(canonical.data());
        const projected = normaliseParentConsentEnabled(projection.data());
        const projectionConfigured = Object.hasOwn(projection.data() || {}, "parentConsentEnabled");
        if (current !== projected || canonical.exists() !== projectionConfigured) {
            throw new ServiceFailure("Parent Portal consent settings are out of sync. Reload settings and try again.", "firestore/failed-precondition");
        }
        if (current !== expectedEnabled) {
            throw new ServiceFailure("Parent Portal consent settings changed in another session. Reload settings before trying again.", "firestore/aborted");
        }

        const audit = { updatedAt: serverTimestamp(), updatedBy: user.uid };
        transaction.set(PARENT_CONSENT_SETTINGS_REF, { parentConsentEnabled: enabled, ...audit });
        transaction.set(PUBLIC_NAVIGATION_SETTINGS_REF, {
            ...projection.data(),
            parentConsentEnabled: enabled
        });
    });
}
