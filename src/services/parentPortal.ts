import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "firebase/auth";
import type { User } from "firebase/auth";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
    setDoc,
    updateDoc
} from "firebase/firestore";

import { auth, db } from "../firebase";

export type ParentAccessStatus = "pending" | "approved" | "rejected";

export type ParentAccount = {
    uid: string;
    email: string;
    displayName: string;
    mobileNumber: string;
    status: ParentAccessStatus;
    memberIds: string[];
};

function clean(value: string, max: number): string {
    return value.trim().slice(0, max);
}

function mapParentAccount(uid: string, data: Record<string, unknown>): ParentAccount {
    return {
        uid,
        email: typeof data.email === "string" ? data.email : "",
        displayName: typeof data.displayName === "string" ? data.displayName : "",
        mobileNumber: typeof data.mobileNumber === "string" ? data.mobileNumber : "",
        status:
            data.status === "approved" || data.status === "rejected"
                ? data.status
                : "pending",
        memberIds: Array.isArray(data.memberIds)
            ? data.memberIds.filter((value): value is string => typeof value === "string")
            : []
    };
}

export function observeParentAuth(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
}

export function currentUser(): User | null {
    return auth.currentUser;
}

export async function registerParent(
    email: string,
    password: string,
    displayName: string,
    mobileNumber: string
): Promise<void> {
    await createUserWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
    );

    await createParentAccessForCurrentUser(displayName, mobileNumber);
}

export async function createParentAccessForCurrentUser(
    displayName: string,
    mobileNumber: string
): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in user.");

    const existing = await getDoc(doc(db, "parentAccounts", user.uid));
    if (existing.exists()) return;

    await setDoc(doc(db, "parentAccounts", user.uid), {
        uid: user.uid,
        email: (user.email || "").trim().toLowerCase(),
        displayName: clean(displayName, 150),
        mobileNumber: clean(mobileNumber, 40),
        status: "pending",
        memberIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
}

export async function loginParent(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export async function logoutParent(): Promise<void> {
    await signOut(auth);
}

export async function loadParentAccount(uid: string): Promise<ParentAccount | null> {
    const snapshot = await getDoc(doc(db, "parentAccounts", uid));

    if (!snapshot.exists()) return null;
    return mapParentAccount(uid, snapshot.data());
}

export async function loadParentAccounts(): Promise<ParentAccount[]> {
    const snapshot = await getDocs(collection(db, "parentAccounts"));
    return snapshot.docs
        .map((item) => mapParentAccount(item.id, item.data()))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function isCurrentUserActiveLeader(): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) return false;

    try {
        const snapshot = await getDoc(doc(db, "adminUsers", user.uid));
        return snapshot.exists() && snapshot.data().active === true;
    } catch {
        return false;
    }
}

export async function updateParentAccess(
    uid: string,
    status: ParentAccessStatus,
    memberIds: string[]
): Promise<void> {
    const leader = auth.currentUser;
    if (!leader) throw new Error("No signed-in leader.");

    await updateDoc(doc(db, "parentAccounts", uid), {
        status,
        memberIds: [...new Set(memberIds)],
        reviewedBy: leader.uid,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
}
