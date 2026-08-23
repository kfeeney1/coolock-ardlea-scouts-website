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

export type SystemRole = "super-admin" | "admin" | "leader";

export type AdminProfile = {
    uid: string;
    email: string;
    displayName: string;
    role: SystemRole;
    sections: string[];
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
    const snapshot = await getDoc(doc(db, "adminUsers", user.uid));
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

    return {
        uid: user.uid,
        email: user.email ?? "",
        displayName: typeof data.displayName === "string" ? data.displayName : user.email ?? "Leader",
        role,
        sections
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
