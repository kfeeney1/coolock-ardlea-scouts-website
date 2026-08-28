import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState
} from "react";
import type { ReactNode } from "react";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../../firebase";
import { normalizeLeaderRole, normalizeLeaderSections } from "../../services/leaderAccessLogic";
import {
    remainingInactivityMs,
    SESSION_LAST_ACTIVITY_KEY,
    sessionInactivityTimeoutMs
} from "../../services/sessionInactivity";

export type SystemRole = "super-admin" | "admin" | "leader";

export type AdminProfile = {
    uid: string;
    email: string;
    displayName: string;
    role: SystemRole;
    sections: string[];
    scoutingRole: string;
};

type AdminAuthContextValue = {
    user: User | null;
    adminProfile: AdminProfile | null;
    loading: boolean;
    authorised: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

async function loadAdminProfile(user: User): Promise<AdminProfile | null> {
    const [snapshot, organisationSnapshot] = await Promise.all([
        getDoc(doc(db, "adminUsers", user.uid)),
        getDoc(doc(db, "organisationLeadership", user.uid))
    ]);
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    if (data.active !== true) return null;

    const sections = normalizeLeaderSections(data);
    let role: SystemRole;
    try {
        role = normalizeLeaderRole(data.role);
    } catch {
        return null;
    }

    if (sections.length === 0) return null;
    const organisationData = organisationSnapshot.exists() ? organisationSnapshot.data() : null;

    return {
        uid: user.uid,
        email: user.email ?? "",
        displayName: typeof data.displayName === "string" ? data.displayName : user.email ?? "Leader",
        role,
        sections,
        scoutingRole: typeof organisationData?.scoutingRole === "string" ? organisationData.scoutingRole : ""
    };
}

type Props = { children: ReactNode };

export function AdminAuthProvider({ children }: Props) {
    const [user, setUser] = useState<User | null>(null);
    const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
            setLoading(true);
            setUser(nextUser);
            if (!nextUser) {
                setAdminProfile(null);
                setLoading(false);
                return;
            }
            try {
                setAdminProfile(await loadAdminProfile(nextUser));
            } catch (error) {
                console.error("Unable to validate leader access:", error);
                setAdminProfile(null);
            } finally {
                setLoading(false);
            }
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!user) return;

        const navigatorWithHints = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
        const timeoutMs = sessionInactivityTimeoutMs(
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
                console.error("Unable to sign out inactive session:", error);
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
    }, [user]);

    const login = async (email: string, password: string) => {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const profile = await loadAdminProfile(credential.user);
        if (!profile) {
            await signOut(auth);
            throw new Error("This account is not approved for leader access.");
        }
        setUser(credential.user);
        setAdminProfile(profile);
    };

    const logout = async () => {
        await signOut(auth);
        setUser(null);
        setAdminProfile(null);
    };

    const value = useMemo<AdminAuthContextValue>(() => ({
        user,
        adminProfile,
        loading,
        authorised: Boolean(user) && Boolean(adminProfile),
        login,
        logout
    }), [user, adminProfile, loading]);

    return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
    const context = useContext(AdminAuthContext);
    if (!context) throw new Error("useAdminAuth must be used inside AdminAuthProvider.");
    return context;
}
