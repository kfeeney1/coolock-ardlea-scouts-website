import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "../firebase";

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
const MIN_TIMEOUT_MINUTES = 5;
const MAX_TIMEOUT_MINUTES = 240;

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
    if (!user) throw new Error("You must be signed in to change site settings.");

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
