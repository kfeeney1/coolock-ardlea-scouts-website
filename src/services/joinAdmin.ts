import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    updateDoc,
    where
} from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot, Timestamp } from "firebase/firestore";

import { auth, db } from "../firebase";
import { normalizeLeaderSections } from "./leaderAccessLogic";

export type JoinStatus = "new" | "contacted" | "waiting-list" | "accepted" | "closed";
export type ContactMethod = "phone" | "email" | "text" | "in-person" | "other";

export type ContactHistoryEntry = {
    id: string;
    date: string;
    method: ContactMethod;
    note: string;
    leaderUid: string;
};

export type JoinApplicationRecord = {
    id: string;
    childFirstName: string;
    childLastName: string;
    childName: string;
    childDob: string;
    parentName: string;
    emailAddress: string;
    mobileNumber: string;
    section: string;
    status: JoinStatus;
    notes: string;
    contactHistory: ContactHistoryEntry[];
    submittedAt: Date | null;
    updatedAt: Date | null;
    memberId: string;
    data: Record<string, unknown>;
};

const JOIN_STATUSES = ["new", "contacted", "waiting-list", "accepted", "closed"] as const;
const CONTACT_METHODS = ["phone", "email", "text", "in-person", "other"] as const;

function timestampToDate(value: unknown): Date | null {
    if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
        return (value as Timestamp).toDate();
    }
    return null;
}

function stringValue(data: DocumentData, key: string): string {
    const value = data[key];
    return typeof value === "string" ? value.trim() : "";
}

function mapContactHistory(value: unknown): ContactHistoryEntry[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        if (
            typeof record.id !== "string" ||
            typeof record.date !== "string" ||
            typeof record.method !== "string" ||
            !CONTACT_METHODS.includes(record.method as ContactMethod) ||
            typeof record.note !== "string" ||
            typeof record.leaderUid !== "string"
        ) return [];
        return [{
            id: record.id,
            date: record.date,
            method: record.method as ContactMethod,
            note: record.note.trim(),
            leaderUid: record.leaderUid
        }];
    });
}

function mapJoin(snapshot: QueryDocumentSnapshot<DocumentData>): JoinApplicationRecord | null {
    const data = snapshot.data();
    const childFirstName = stringValue(data, "childFirstName");
    const childLastName = stringValue(data, "childLastName");
    const childDob = stringValue(data, "dateOfBirth");
    const parentName = stringValue(data, "parentName");
    const emailAddress = stringValue(data, "emailAddress");
    const mobileNumber = stringValue(data, "mobileNumber");
    const section = stringValue(data, "section");
    const status = stringValue(data, "status") as JoinStatus;

    if (
        !childFirstName || !childLastName || !childDob || !parentName || !emailAddress || !mobileNumber || !section ||
        !JOIN_STATUSES.includes(status)
    ) return null;

    return {
        id: snapshot.id,
        childFirstName,
        childLastName,
        childName: `${childFirstName} ${childLastName}`.trim(),
        childDob,
        parentName,
        emailAddress,
        mobileNumber,
        section,
        status,
        notes: stringValue(data, "notes"),
        contactHistory: mapContactHistory(data.contactHistory),
        submittedAt: timestampToDate(data.submittedAt),
        updatedAt: timestampToDate(data.updatedAt),
        memberId: stringValue(data, "memberId"),
        data
    };
}

export async function loadJoinApplications(): Promise<JoinApplicationRecord[]> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");

    const profileSnapshot = await getDoc(doc(db, "adminUsers", user.uid));
    if (!profileSnapshot.exists() || profileSnapshot.data().active !== true) {
        throw new Error("Active leader profile is required.");
    }

    const profile = profileSnapshot.data();
    const isAdmin = profile.role === "admin" || profile.role === "super-admin";

    let documents: QueryDocumentSnapshot<DocumentData>[];
    if (isAdmin) {
        documents = (await getDocs(query(collection(db, "joinApplications"), orderBy("submittedAt", "desc")))).docs;
    } else {
        const sections = normalizeLeaderSections(profile);
        if (sections.length === 0) return [];
        const snapshots = await Promise.all(
            sections.map((section) => getDocs(query(collection(db, "joinApplications"), where("section", "==", section))))
        );
        const byId = new Map<string, QueryDocumentSnapshot<DocumentData>>();
        snapshots.forEach((snapshot) => snapshot.docs.forEach((item) => byId.set(item.id, item)));
        documents = [...byId.values()];
    }

    return documents
        .map(mapJoin)
        .filter((record): record is JoinApplicationRecord => record !== null)
        .sort((left, right) => (right.submittedAt?.getTime() ?? 0) - (left.submittedAt?.getTime() ?? 0));
}

export async function updateJoinStatus(applicationId: string, status: JoinStatus): Promise<void> {
    await updateDoc(doc(db, "joinApplications", applicationId), { status, updatedAt: serverTimestamp() });
}

export async function updateJoinNotes(applicationId: string, notes: string): Promise<void> {
    await updateDoc(doc(db, "joinApplications", applicationId), {
        notes: notes.trim().slice(0, 5000),
        updatedAt: serverTimestamp()
    });
}

export async function addContactHistoryEntry(
    application: JoinApplicationRecord,
    method: ContactMethod,
    note: string
): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");

    const entry: ContactHistoryEntry = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        method,
        note: note.trim().slice(0, 1500),
        leaderUid: user.uid
    };

    await updateDoc(doc(db, "joinApplications", application.id), {
        contactHistory: [...application.contactHistory, entry],
        status: application.status === "new" ? "contacted" : application.status,
        updatedAt: serverTimestamp()
    });
}

export async function convertJoinApplicationToMember(application: JoinApplicationRecord): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");

    const applicationRef = doc(db, "joinApplications", application.id);
    const memberRef = doc(collection(db, "members"));

    await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(applicationRef);
        if (!snapshot.exists()) throw new Error("The joining application no longer exists.");

        const current = snapshot.data();
        if (current.memberId && typeof current.memberId === "string") {
            throw new Error("This enquiry has already been converted to a member.");
        }
        if (current.status !== "accepted") throw new Error("Only accepted joining enquiries can be converted to members.");

        transaction.set(memberRef, {
            firstName: application.childFirstName,
            lastName: application.childLastName,
            displayName: application.childName,
            dateOfBirth: application.childDob,
            section: application.section,
            parentName: application.parentName,
            emailAddress: application.emailAddress,
            mobileNumber: application.mobileNumber,
            emergencyContactName: stringValue(current, "emergencyContactName"),
            emergencyContactPhone: stringValue(current, "emergencyContactPhone"),
            status: "active",
            source: "join-application",
            sourceJoinApplicationId: application.id,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
        });

        transaction.update(applicationRef, {
            memberId: memberRef.id,
            convertedAt: serverTimestamp(),
            convertedBy: user.uid,
            updatedAt: serverTimestamp()
        });
    });

    return memberRef.id;
}
