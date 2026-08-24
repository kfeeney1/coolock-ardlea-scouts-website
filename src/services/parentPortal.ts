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
import { normalizeLeaderRole, normalizeLeaderSections } from "./leaderAccessLogic";
import {
    notifyParentAccessApproved,
    notifyParentAccessRejected,
    notifyParentRegistration
} from "./emailNotifications";

export type ParentAccessStatus = "pending" | "approved" | "rejected";

export type ParentAccount = {
    uid: string;
    email: string;
    displayName: string;
    mobileNumber: string;
    status: ParentAccessStatus;
    memberIds: string[];
    linkedSections: string[];
};

function clean(value: string, max: number): string {
    return value.trim().slice(0, max);
}

function mapStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null;
    return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

function mapParentAccount(uid: string, data: Record<string, unknown>): ParentAccount | null {
    const email = typeof data.email === "string" ? data.email.trim() : "";
    const displayName = typeof data.displayName === "string" ? data.displayName.trim() : "";
    const mobileNumber = typeof data.mobileNumber === "string" ? data.mobileNumber.trim() : "";
    const status = data.status as ParentAccessStatus;
    const memberIds = mapStringArray(data.memberIds);
    const linkedSections = mapStringArray(data.linkedSections);
    if (!email || !displayName || !mobileNumber || !["pending", "approved", "rejected"].includes(status) || !memberIds || !linkedSections) return null;
    return { uid, email, displayName, mobileNumber, status, memberIds, linkedSections };
}

export function observeParentAuth(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
}

export function currentUser(): User | null {
    return auth.currentUser;
}

export async function registerParent(email: string, password: string, displayName: string, mobileNumber: string): Promise<void> {
    await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    await createParentAccessForCurrentUser(displayName, mobileNumber);
}

export async function createParentAccessForCurrentUser(displayName: string, mobileNumber: string): Promise<void> {
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
        linkedSections: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    try { await notifyParentRegistration(); } catch (emailError) { console.error("Unable to send parent registration emails:", emailError); }
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
        .filter((account): account is ParentAccount => account !== null)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function isCurrentUserActiveLeader(): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) return false;

    try {
        const snapshot = await getDoc(doc(db, "adminUsers", user.uid));
        if (!snapshot.exists() || snapshot.data().active !== true) return false;
        normalizeLeaderRole(snapshot.data().role);
        return normalizeLeaderSections(snapshot.data()).length > 0;
    } catch {
        return false;
    }
}

export async function updateParentAccess(uid: string, status: ParentAccessStatus, memberIds: string[], linkedSections: string[] = []): Promise<void> {
    const leader = auth.currentUser;
    if (!leader) throw new Error("No signed-in leader.");

    const accountRef = doc(db, "parentAccounts", uid);
    const beforeSnapshot = await getDoc(accountRef);
    const beforeAccount = beforeSnapshot.exists() ? mapParentAccount(uid, beforeSnapshot.data()) : null;
    if (beforeSnapshot.exists() && !beforeAccount) throw new Error("Parent account does not match the canonical data contract.");

    const uniqueMemberIds = [...new Set(memberIds.map((id) => id.trim()).filter(Boolean))];
    const uniqueSections = [...new Set(linkedSections.map((section) => section.trim()).filter(Boolean))];

    await updateDoc(accountRef, {
        status,
        memberIds: status === "approved" ? uniqueMemberIds : [],
        linkedSections: status === "approved" ? uniqueSections : [],
        reviewedBy: leader.uid,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    if (!beforeAccount || beforeAccount.status === status) return;
    try {
        if (status === "approved") {
            await notifyParentAccessApproved({ ...beforeAccount, status: "approved", memberIds: uniqueMemberIds, linkedSections: uniqueSections }, uniqueMemberIds.length);
        } else if (status === "rejected") {
            await notifyParentAccessRejected({ ...beforeAccount, status: "rejected" });
        }
    } catch (emailError) {
        console.error("Unable to send parent access status email:", emailError);
    }
}
