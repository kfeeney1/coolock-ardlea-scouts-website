import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { notifyLeaderAccessStatus, notifyLeaderRegistration } from "./emailNotifications";

export type RequestedLeaderRole = "Scouter" | "Section Leader" | "Group Leader" | "Other";
export type RequestedSection = "Beavers" | "Cubs" | "Scouts" | "Ventures" | "Rovers" | "Group" | "Other";
export type LeaderRegistrationInput = { fullName: string; email: string; password: string; mobileNumber: string; requestedRole: RequestedLeaderRole | ""; requestedSection: RequestedSection | ""; reason: string; privacyConfirmed: boolean; };
export type LeaderRegistrationRequest = { uid: string; fullName: string; email: string; mobileNumber: string; requestedRole: string; requestedSection: string; reason: string; status: "pending" | "approved" | "rejected"; submittedAt: Date | null; reviewedAt: Date | null; reviewedBy: string; reviewNote: string; };
const clean = (value: string, maxLength: number) => value.trim().slice(0, maxLength);
function toDate(value: unknown): Date | null { if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") return (value as Timestamp).toDate(); return null; }
function mapRequest(id: string, data: Record<string, unknown>): LeaderRegistrationRequest { return { uid: typeof data.uid === "string" ? data.uid : id, fullName: typeof data.fullName === "string" ? data.fullName : "", email: typeof data.email === "string" ? data.email : "", mobileNumber: typeof data.mobileNumber === "string" ? data.mobileNumber : "", requestedRole: typeof data.requestedRole === "string" ? data.requestedRole : "", requestedSection: typeof data.requestedSection === "string" ? data.requestedSection : "", reason: typeof data.reason === "string" ? data.reason : "", status: data.status === "approved" || data.status === "rejected" ? data.status : "pending", submittedAt: toDate(data.submittedAt), reviewedAt: toDate(data.reviewedAt), reviewedBy: typeof data.reviewedBy === "string" ? data.reviewedBy : "", reviewNote: typeof data.reviewNote === "string" ? data.reviewNote : "" }; }

export async function registerLeader(input: LeaderRegistrationInput): Promise<void> {
    const credential = await createUserWithEmailAndPassword(auth, input.email.trim().toLowerCase(), input.password);
    try {
        await setDoc(doc(db, "leaderRegistrationRequests", credential.user.uid), { uid: credential.user.uid, fullName: clean(input.fullName, 150), email: clean(input.email, 254).toLowerCase(), mobileNumber: clean(input.mobileNumber, 40), requestedRole: input.requestedRole, requestedSection: input.requestedSection, reason: clean(input.reason, 1500), privacyConfirmed: input.privacyConfirmed, status: "pending", submittedAt: serverTimestamp(), reviewedAt: null, reviewedBy: "", reviewNote: "" });
        try { await notifyLeaderRegistration(); } catch (emailError) { console.error("Unable to send leader registration emails:", emailError); }
    } finally { await signOut(auth); }
}

export async function loadLeaderRegistrationRequests(): Promise<LeaderRegistrationRequest[]> {
    const snapshot = await getDocs(query(collection(db, "leaderRegistrationRequests"), orderBy("submittedAt", "desc")));
    return snapshot.docs.map((requestDocument) => mapRequest(requestDocument.id, requestDocument.data()));
}

export async function approveLeaderRegistration(request: LeaderRegistrationRequest, reviewerUid: string, reviewNote: string): Promise<void> {
    await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, "leaderRegistrationRequests", request.uid);
        const adminRef = doc(db, "adminUsers", request.uid);
        const snapshot = await transaction.get(requestRef);
        if (!snapshot.exists()) throw new Error("Registration request no longer exists.");
        if (snapshot.data().status !== "pending") throw new Error("Only pending requests can be approved.");
        const sections = request.requestedSection ? [request.requestedSection] : [];
        transaction.set(adminRef, { active: true, displayName: request.fullName, email: request.email, role: "leader", sections, section: request.requestedSection, approvedAt: serverTimestamp(), approvedBy: reviewerUid });
        transaction.update(requestRef, { status: "approved", reviewedAt: serverTimestamp(), reviewedBy: reviewerUid, reviewNote: clean(reviewNote, 1000) });
    });
    try { await notifyLeaderAccessStatus(request.email, request.fullName, "approved", request.requestedSection); } catch (emailError) { console.error("Unable to send leader approval email:", emailError); }
}

export async function rejectLeaderRegistration(requestUid: string, reviewerUid: string, reviewNote: string): Promise<void> {
    const requestRef = doc(db, "leaderRegistrationRequests", requestUid);
    const snapshot = await getDoc(requestRef);
    const request = snapshot.exists() ? mapRequest(snapshot.id, snapshot.data()) : null;
    await updateDoc(requestRef, { status: "rejected", reviewedAt: serverTimestamp(), reviewedBy: reviewerUid, reviewNote: clean(reviewNote, 1000) });
    if (request) {
        try { await notifyLeaderAccessStatus(request.email, request.fullName, "rejected", request.requestedSection); } catch (emailError) { console.error("Unable to send leader rejection email:", emailError); }
    }
}
