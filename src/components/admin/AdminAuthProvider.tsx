import { applicationErrorMessage, ServiceFailure, reportApplicationError } from "../../services/applicationErrors.ts";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import type { ReactNode } from "react";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, getDoc, onSnapshot, type DocumentData } from "firebase/firestore";

import { auth, db } from "../../firebase";
import { isDeniedLeaderProfileProbe, normalizeLeaderRole, normalizeLeaderSections } from "../../services/leaderAccessLogic";
import { nextAppointmentBoundary, normalizeScoutingAppointmentAssignments, type ScoutingAppointmentAssignment } from "../../security/scoutingAppointments";
import {
    remainingInactivityMs,
    SESSION_LAST_ACTIVITY_KEY,
    sessionInactivityTimeoutMs
} from "../../services/sessionInactivity";
import {
    DEFAULT_SESSION_SETTINGS,
    loadSessionSettings
} from "../../services/siteSettings";
import type { SessionSettings } from "../../services/siteSettings";
import { normalizeThemePreference, type ThemeName } from "../../theme/themePreferences";
import { saveThemePreference } from "../../services/themePreference";

export type SystemRole = "super-admin" | "admin" | "leader";

export type AdminProfile = {
    uid: string;
    email: string;
    displayName: string;
    role: SystemRole;
    sections: string[];
    scoutingRole: string;
    appointments: ScoutingAppointmentAssignment[];
    uiTheme: ThemeName;
};

type AdminAuthContextValue = {
    user: User | null;
    adminProfile: AdminProfile | null;
    loading: boolean;
    authorised: boolean;
    sessionEnded: boolean;
    accessError: string;
    sessionSettings: SessionSettings;
    refreshSessionSettings: () => Promise<void>;
    setUiTheme: (theme: ThemeName) => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

async function loadAdminProfile(user: User): Promise<AdminProfile | null> {
    const [snapshot, organisationSnapshot] = await Promise.all([
        getDoc(doc(db, "adminUsers", user.uid)),
        getDoc(doc(db, "organisationLeadership", user.uid))
    ]);
    return resolveAdminProfile(user, snapshot.data(), organisationSnapshot.data());
}

function resolveAdminProfile(user: User, data?: DocumentData, organisation?: DocumentData): AdminProfile | null {
    if (data?.active !== true) return null;

    const sections = normalizeLeaderSections(data);
    let role: SystemRole;
    try {
        role = normalizeLeaderRole(data.role);
    } catch {
        return null;
    }

    if (sections.length === 0) return null;
    const organisationData = organisation?.active === true ? organisation : undefined;
    const hasAssignments = Array.isArray(organisationData?.appointments) && organisationData.appointments.length > 0;
    const label = typeof organisationData?.scoutingRole === "string" ? organisationData.scoutingRole : "";
    const appointments = normalizeScoutingAppointmentAssignments(
        organisationData?.appointments,
        hasAssignments ? "" : label,
        organisationData?.organisationSection
    );

    return {
        uid: user.uid,
        email: user.email ?? "",
        displayName: typeof data.displayName === "string" ? data.displayName : user.email ?? "Leader",
        role,
        sections,
        scoutingRole: hasAssignments && appointments.length === 0 ? "" : label,
        appointments,
        uiTheme: normalizeThemePreference(data.uiTheme)
    };
}

type Props = { children: ReactNode };

export function AdminAuthProvider({ children }: Props) {
    const [user, setUser] = useState<User | null>(null);
    const [accessError, setAccessError] = useState("");
    const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
    const [sessionSettings, setSessionSettings] = useState<SessionSettings>(DEFAULT_SESSION_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [sessionEnded, setSessionEnded] = useState(false);
    const authStateVersion = useRef(0);
    const hasAuthenticatedSession = useRef(false);

    const refreshSessionSettings = async () => {
        try {
            setSessionSettings(await loadSessionSettings());
        } catch (error) {
            reportApplicationError(error, { area: "AdminAuthProvider", operation: "Unable to load session settings; using defaults" });
            setSessionSettings(DEFAULT_SESSION_SETTINGS);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
            const version = ++authStateVersion.current;
            if (nextUser) {
                hasAuthenticatedSession.current = true;
            } else if (hasAuthenticatedSession.current) {
                // Once a signed-in session ends, a subsequent login starts at
                // the account's home. A route saved by the protected-route
                // guard during this transition is stale session state.
                setSessionEnded(true);
            }
            setLoading(true);
            setAccessError("");
            setUser(nextUser);
            if (!nextUser) {
                setAdminProfile(null);
                setSessionSettings(DEFAULT_SESSION_SETTINGS);
                setLoading(false);
                return;
            }

            const [profileResult, settingsResult] = await Promise.allSettled([
                loadAdminProfile(nextUser),
                loadSessionSettings()
            ]);

            // A newer auth event (most importantly sign-out) wins. Do not let an
            // older signed-in profile/settings read re-authorise or prolong the
            // loading state after the session has already changed.
            if (version !== authStateVersion.current || auth.currentUser?.uid !== nextUser.uid) {
                return;
            }

            if (profileResult.status === "fulfilled") {
                setAdminProfile(profileResult.value);
            } else {
                if (isDeniedLeaderProfileProbe(profileResult.reason)) {
                    reportApplicationError(profileResult.reason, { area: "Authentication", operation: "Denied background leader role probe" });
                } else {
                    setAccessError(applicationErrorMessage(profileResult.reason, "Leader access could not be checked.", "Authentication", "Load leader access profile"));
                }
                setAdminProfile(null);
            }

            if (settingsResult.status === "fulfilled") {
                setSessionSettings(settingsResult.value);
            } else {
                reportApplicationError(settingsResult.reason, { area: "AdminAuthProvider", operation: "Unable to load session settings; using defaults" });
                setSessionSettings(DEFAULT_SESSION_SETTINGS);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const leaderUid = adminProfile?.uid;
    useEffect(() => {
        if (!user || user.uid !== leaderUid) return;
        let cancelled = false;
        let account: DocumentData | undefined;
        let organisation: DocumentData | undefined;
        let accountReady = false;
        let organisationReady = false;
        const currentSession = () => !cancelled && auth.currentUser?.uid === user.uid;
        const publish = () => {
            if (!currentSession() || !accountReady || !organisationReady) return;
            setAdminProfile(resolveAdminProfile(user, account, organisation));
        };
        const failed = (error: unknown) => {
            if (!currentSession()) return;
            setAdminProfile(null);
            if (!isDeniedLeaderProfileProbe(error)) {
                setAccessError(applicationErrorMessage(error, "Leader access could not be checked.", "Authentication"));
            }
        };
        const options = { includeMetadataChanges: true };
        const stopAccount = onSnapshot(doc(db, "adminUsers", user.uid), options, snapshot => {
            if (!currentSession() || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
            account = snapshot.data();
            accountReady = true;
            if (account?.active !== true) setAdminProfile(null);
            else publish();
        }, failed);
        const stopOrganisation = onSnapshot(doc(db, "organisationLeadership", user.uid), options, snapshot => {
            if (!currentSession() || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
            organisation = snapshot.data();
            organisationReady = true;
            publish();
        }, failed);
        return () => {
            cancelled = true;
            stopAccount();
            stopOrganisation();
        };
    }, [user, leaderUid]);

    useEffect(() => {
        if (!adminProfile) return;
        const boundary = nextAppointmentBoundary(adminProfile.appointments, Date.now());
        if (boundary === undefined) return;
        let timer: number | undefined;
        const refresh = () => {
            if (timer !== undefined) window.clearTimeout(timer);
            const remaining = boundary - Date.now();
            if (remaining <= 0) {
                // Capability selectors resolve effective dates from the current UTC day.
                setAdminProfile(current => current === adminProfile ? { ...current } : current);
            } else {
                timer = window.setTimeout(refresh, Math.min(remaining, 2_147_483_647));
            }
        };
        refresh();
        window.addEventListener("focus", refresh);
        return () => {
            if (timer !== undefined) window.clearTimeout(timer);
            window.removeEventListener("focus", refresh);
        };
    }, [adminProfile]);

    const accountType = adminProfile ? "leader" : "parent";
    useEffect(() => {
        if (!user || loading) return;

        const navigatorWithHints = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
        const timeoutMs = sessionInactivityTimeoutMs(
            accountType,
            sessionSettings,
            navigator.userAgent,
            navigatorWithHints.userAgentData?.mobile
        );
        const activityEvents: Array<keyof WindowEventMap> = [
            "pointerdown",
            "keydown",
            "scroll",
            "touchstart",
            "wheel"
        ];
        let timeoutId: number | undefined;
        let signingOut = false;

        const readLastActivity = () => {
            const stored = Number(window.localStorage.getItem(SESSION_LAST_ACTIVITY_KEY));
            return Number.isFinite(stored) && stored > 0 ? stored : Date.now();
        };

        const expireSession = async () => {
            if (signingOut) return;
            signingOut = true;
            try {
                await signOut(auth);
            } catch (error) {
                signingOut = false;
                reportApplicationError(error, { area: "AdminAuthProvider", operation: "Unable to sign out inactive session" });
            }
        };

        const scheduleTimeout = () => {
            if (timeoutId !== undefined) window.clearTimeout(timeoutId);
            const remaining = remainingInactivityMs(readLastActivity(), Date.now(), timeoutMs);
            if (remaining === 0) {
                void expireSession();
                return;
            }
            timeoutId = window.setTimeout(() => {
                const latestRemaining = remainingInactivityMs(readLastActivity(), Date.now(), timeoutMs);
                if (latestRemaining === 0) void expireSession();
                else scheduleTimeout();
            }, remaining);
        };

        const recordActivity = () => {
            window.localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
            scheduleTimeout();
        };

        const checkOnReturn = () => {
            const remaining = remainingInactivityMs(readLastActivity(), Date.now(), timeoutMs);
            if (remaining === 0) void expireSession();
            else recordActivity();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") checkOnReturn();
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === SESSION_LAST_ACTIVITY_KEY) scheduleTimeout();
        };

        recordActivity();
        activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
        window.addEventListener("focus", checkOnReturn);
        window.addEventListener("storage", handleStorage);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            if (timeoutId !== undefined) window.clearTimeout(timeoutId);
            activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
            window.removeEventListener("focus", checkOnReturn);
            window.removeEventListener("storage", handleStorage);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [user, accountType, loading, sessionSettings]);

    const login = async (email: string, password: string) => {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const profile = await loadAdminProfile(credential.user);
        if (!profile) {
            await signOut(auth);
            throw new ServiceFailure("This account is not approved for leader access.", "app/permission-denied");
        }
        setUser(credential.user);
        setAdminProfile(profile);
        setSessionEnded(false);
        await refreshSessionSettings();
    };

    const logout = async () => {
        // Keep the current session recoverable if Firebase rejects sign-out.
        // Once Firebase confirms it, clear privileged application state without
        // waiting for the asynchronous auth observer to finish rendering.
        await signOut(auth);
        ++authStateVersion.current;
        setUser(null);
        setAdminProfile(null);
        setSessionEnded(true);
        setSessionSettings(DEFAULT_SESSION_SETTINGS);
        setLoading(false);
        window.localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
    };

    const setUiTheme = useCallback(async (theme: ThemeName) => {
        if (adminProfile?.role !== "super-admin") throw new Error("Only a Super Admin can change the look and feel.");
        await saveThemePreference(theme);
        setAdminProfile((current) => current ? { ...current, uiTheme: theme } : current);
    }, [adminProfile?.role]);

    const value = useMemo<AdminAuthContextValue>(() => ({
        user,
        adminProfile,
        loading,
        accessError,
        authorised: Boolean(user) && Boolean(adminProfile),
        sessionEnded,
        sessionSettings,
        refreshSessionSettings,
        setUiTheme,
        login,
        logout
    }), [user, adminProfile, loading, accessError, sessionSettings, sessionEnded, setUiTheme]);

    return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
    const context = useContext(AdminAuthContext);
    if (!context) throw new Error("useAdminAuth must be used inside AdminAuthProvider.");
    return context;
}
