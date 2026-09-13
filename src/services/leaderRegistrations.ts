import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { notifyLeaderAccessStatus, notifyLeaderRegistration } from "./emailNotifications";

export type RequestedLeaderRole = "Scouter" | "Section Leader" | "Group Leader" | "Deputy Group Leader" | "Other";
export type RequestedSection = "Beavers" | "Cubs" | "Scouts" | "Ventures" | "Rovers" | "Group" | "Other";
export type LeaderRegistrationInput = { fullName: string; email: string; password: string; mobileNumber: string; requestedRole: RequestedLeaderRole | ""; requestedSection: RequestedSection | ""; reason: string; privacyConfirmed: boolean; };
export type LeaderRegistrationRequest = { uid: string; fullName: string; email: string; mobileNumber: string; requestedRole: string; requestedSection: string; reason: string; status: "pending" | "approved" | "rejected"; submittedAt: Date | null; reviewedAt: Date | null; reviewedBy: string; reviewNote: string; matchingParentStatus?: string; };
const clean = (value: string, maxLength: number) => value.trim().slice(0, maxLength);
const normalizeEmail = (value: string) => value.trim().toLowerCase();
function authErrorCode(error: unknown): string { return typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : ""; }
function toDate(value: unknown): Date | null { if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") return (value as Timestamp).toDate(); return null; }
function mapRequest(id: string, data: Record<string, unknown>): LeaderRegistrationRequest { return { uid: typeof data.uid === "string" ? data.uid : id, fullName: typeof data.fullName === "string" ? data.fullName : "", email: typeof data.email === "string" ? data.email : "", mobileNumber: typeof data.mobileNumber === "string" ? data.mobileNumber : "", requestedRole: typeof data.requestedRole === "string" ? data.requestedRole : "", requestedSection: typeof data.requestedSection === "string" ? data.requestedSection : "", reason: typeof data.reason === "string" ? data.reason : "", status: data.status === "approved" || data.status === "rejected" ? data.status : "pending", submittedAt: toDate(data.submittedAt), reviewedAt: toDate(data.reviewedAt), reviewedBy: typeof data.reviewedBy === "string" ? data.reviewedBy : "", reviewNote: typeof data.reviewNote === "string" ? data.reviewNote : "" }; }

export async function registerLeader(input: LeaderRegistrationInput): Promise<void> {
    const existingUser = auth.currentUser;
    const requestedEmail = normalizeEmail(input.email);
    let user = existingUser;
    let shouldSignOut = false;

    if (existingUser) {
        const existingEmail = normalizeEmail(existingUser.email || "");
        if (!existingEmail || existingEmail !== requestedEmail) {
            throw new Error("Leader request email must match the signed-in account.");
        }
    } else {
        try {
            const credential = await createUserWithEmailAndPassword(auth, requestedEmail, input.password);
            user = credential.user;
            shouldSignOut = true;
        } catch (error) {
            if (authErrorCode(error) !== "auth/email-already-in-use") throw error;
            const credential = await signInWithEmailAndPassword(auth, requestedEmail, input.password);
            user = credential.user;
            shouldSignOut = true;
        }
    }

    if (!user) throw new Error("Unable to determine the Firebase user for this request.");

    try {
        const requestRef = doc(db, "leaderRegistrationRequests", user.uid);
        const existingRequest = await getDoc(requestRef);
        if (existingRequest.exists()) {
            const status = existingRequest.data().status;
            if (status === "pending") throw new Error("A leader access request is already pending for this account.");
            if (status === "approved") throw new Error("This account already has an approved leader request.");
            throw new Error("A previous leader access request exists for this account. Contact an administrator to review it.");
        }

        await setDoc(requestRef, {
            uid: user.uid,
            fullName: clean(input.fullName, 150),
            email: requestedEmail,
            mobileNumber: clean(input.mobileNumber, 40),
            requestedRole: input.requestedRole,
            requestedSection: input.requestedSection,
            reason: clean(input.reason, 1500),
            privacyConfirmed: input.privacyConfirmed,
            status: "pending",
            submittedAt: serverTimestamp(),
            reviewedAt: null,
            reviewedBy: "",
            reviewNote: ""
        });
        try { await notifyLeaderRegistration(); } catch (emailError) { console.error("Unable to send leader registration emails:", emailError); }
    } finally {
        if (shouldSignOut) await signOut(auth);
    }
}

export async function loadLeaderRegistrationRequests(): Promise<LeaderRegistrationRequest[]> {
    const [requestSnapshot, parentSnapshot] = await Promise.all([
        getDocs(query(collection(db, "leaderRegistrationRequests"), orderBy("submittedAt", "desc"))),
        getDocs(collection(db, "parentAccounts"))
    ]);
    const parentsByUid = new Map(parentSnapshot.docs.map((item) => [item.id, item.data()]));
    const parentsByEmail = new Map(parentSnapshot.docs.flatMap((item) => {
        const email = typeof item.data().email === "string" ? normalizeEmail(item.data().email) : "";
        return email ? [[email, item.data()] as const] : [];
    }));
    return requestSnapshot.docs.map((requestDocument) => {
        const request = mapRequest(requestDocument.id, requestDocument.data());
        const parent = parentsByUid.get(request.uid) ?? parentsByEmail.get(normalizeEmail(request.email));
        const parentStatus = parent && typeof parent.status === "string" ? parent.status : "";
        return parentStatus ? { ...request, matchingParentStatus: parentStatus } : request;
    });
}

export async function approveLeaderRegistration(request: LeaderRegistrationRequest, reviewerUid: string, reviewNote: string): Promise<void> {
    const section = request.requestedSection.trim();
    if (!section) throw new Error("A canonical section is required before approving leader access.");

    await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, "leaderRegistrationRequests", request.uid);
        const adminRef = doc(db, "adminUsers", request.uid);
        const snapshot = await transaction.get(requestRef);
        if (!snapshot.exists()) throw new Error("Registration request no longer exists.");
        if (snapshot.data().status !== "pending") throw new Error("Only pending requests can be approved.");
        transaction.set(adminRef, { active: true, displayName: request.fullName, email: request.email, role: "leader", sections: [section], approvedAt: serverTimestamp(), approvedBy: reviewerUid });
        transaction.update(requestRef, { status: "approved", reviewedAt: serverTimestamp(), reviewedBy: reviewerUid, reviewNote: clean(reviewNote, 1000) });
    });
    try { await notifyLeaderAccessStatus(request.uid, "approved"); } catch (emailError) { console.error("Unable to send leader approval email:", emailError); }
}

export async function rejectLeaderRegistration(requestUid: string, reviewerUid: string, reviewNote: string): Promise<void> {
    const requestRef = doc(db, "leaderRegistrationRequests", requestUid);
    const snapshot = await getDoc(requestRef);
    const request = snapshot.exists() ? mapRequest(snapshot.id, snapshot.data()) : null;
    await updateDoc(requestRef, { status: "rejected", reviewedAt: serverTimestamp(), reviewedBy: reviewerUid, reviewNote: clean(reviewNote, 1000) });
    if (request) {
        try { await notifyLeaderAccessStatus(request.uid, "rejected"); } catch (emailError) { console.error("Unable to send leader rejection email:", emailError); }
    }
}
