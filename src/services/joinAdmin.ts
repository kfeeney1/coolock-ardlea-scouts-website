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

import type {
    DocumentData,
    QueryDocumentSnapshot,
    Timestamp
} from "firebase/firestore";

import { auth, db } from "../firebase";

export type JoinStatus =
    | "new"
    | "contacted"
    | "waiting-list"
    | "accepted"
    | "closed";

export type ContactMethod =
    | "phone"
    | "email"
    | "text"
    | "in-person"
    | "other";

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

function timestampToDate(value: unknown): Date | null {
    if (
        value &&
        typeof value === "object" &&
        "toDate" in value &&
        typeof (value as Timestamp).toDate === "function"
    ) {
        return (value as Timestamp).toDate();
    }
    return null;
}

function stringValue(data: DocumentData, key: string): string {
    const value = data[key];
    return typeof value === "string" ? value.trim() : "";
}

function firstStringValue(data: DocumentData, keys: string[]): string {
    for (const key of keys) {
        const value = stringValue(data, key);
        if (value) return value;
    }
    return "";
}

function mapContactHistory(value: unknown): ContactHistoryEntry[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item) => item && typeof item === "object")
        .map((item) => {
            const record = item as Record<string, unknown>;
            const method = record.method;
            return {
                id: typeof record.id === "string" ? record.id : crypto.randomUUID(),
                date: typeof record.date === "string" ? record.date : "",
                method: (["phone", "email", "text", "in-person", "other"] as ContactMethod[]).includes(method as ContactMethod)
                    ? (method as ContactMethod)
                    : "other",
                note: typeof record.note === "string" ? record.note.trim() : "",
                leaderUid: typeof record.leaderUid === "string" ? record.leaderUid : ""
            };
        });
}

function looksLikePhoneNumber(value: string): boolean {
    if (!value) return false;
    const validCharacters = /^[0-9+\-()\s]+$/;
    const digitCount = (value.match(/\d/g) ?? []).length;
    return validCharacters.test(value) && digitCount >= 7;
}

function latestPhoneFromContactHistory(history: ContactHistoryEntry[]): string {
    const phoneEntries = history
        .filter((entry) => entry.method === "phone" && looksLikePhoneNumber(entry.note))
        .sort((left, right) => {
            const leftTime = Date.parse(left.date);
            const rightTime = Date.parse(right.date);
            if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0;
            return rightTime - leftTime;
        });
    return phoneEntries[0]?.note ?? "";
}

function resolvePhoneNumber(data: DocumentData, history: ContactHistoryEntry[]): string {
    const directPhone = firstStringValue(data, [
        "mobileNumber",
        "phone",
        "phoneNumber",
        "parentPhone",
        "parentMobile",
        "contactNumber",
        "telephone",
        "tel"
    ]);
    return directPhone || latestPhoneFromContactHistory(history);
}

function mapJoin(snapshot: QueryDocumentSnapshot<DocumentData>): JoinApplicationRecord {
    const data = snapshot.data();
    const firstName = firstStringValue(data, ["childFirstName", "firstName"]);
    const lastName = firstStringValue(data, ["childLastName", "lastName"]);
    const contactHistory = mapContactHistory(data.contactHistory);

    return {
        id: snapshot.id,
        childFirstName: firstName,
        childLastName: lastName,
        childName:
            [firstName, lastName].filter(Boolean).join(" ") ||
            firstStringValue(data, ["childName", "name"]) ||
            "Unnamed applicant",
        childDob: firstStringValue(data, ["childDob", "dateOfBirth", "dob"]),
        parentName: firstStringValue(data, ["parentName", "parentGuardianName", "guardianName"]),
        emailAddress: firstStringValue(data, ["emailAddress", "email", "parentEmail"]),
        mobileNumber: resolvePhoneNumber(data, contactHistory),
        section: firstStringValue(data, ["section", "scoutSection"]),
        status: (["new", "contacted", "waiting-list", "accepted", "closed"] as JoinStatus[]).includes(data.status as JoinStatus)
            ? (data.status as JoinStatus)
            : "new",
        notes: stringValue(data, "notes"),
        contactHistory,
        submittedAt: timestampToDate(data.submittedAt),
        updatedAt: timestampToDate(data.updatedAt),
        memberId: stringValue(data, "memberId"),
        data
    };
}

function profileSections(data: DocumentData): string[] {
    const sections = Array.isArray(data.sections)
        ? data.sections.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
    const legacy = stringValue(data, "section");
    return [...new Set([...sections.map((section) => section.trim()), legacy].filter(Boolean))];
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
        const sections = profileSections(profile);
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
        .sort((left, right) => (right.submittedAt?.getTime() ?? 0) - (left.submittedAt?.getTime() ?? 0));
}

export async function updateJoinStatus(applicationId: string, status: JoinStatus): Promise<void> {
    await updateDoc(doc(db, "joinApplications", applicationId), {
        status,
        updatedAt: serverTimestamp()
    });
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

export async function convertJoinApplicationToMember(
    application: JoinApplicationRecord
): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");

    const applicationRef = doc(db, "joinApplications", application.id);
    const memberRef = doc(collection(db, "members"));

    await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(applicationRef);
        if (!snapshot.exists()) {
            throw new Error("The joining application no longer exists.");
        }

        const current = snapshot.data();
        if (current.memberId && typeof current.memberId === "string") {
            throw new Error("This enquiry has already been converted to a member.");
        }
        if (current.status !== "accepted") {
            throw new Error("Only accepted joining enquiries can be converted to members.");
        }

        transaction.set(memberRef, {
            firstName: application.childFirstName,
            lastName: application.childLastName,
            displayName: application.childName,
            dateOfBirth: application.childDob,
            section: application.section,
            parentName: application.parentName,
            emailAddress: application.emailAddress,
            mobileNumber: application.mobileNumber,
            status: "active",
            source: "join-application",
            sourceJoinApplicationId: application.id,
            createdAt: serverTimestamp(),
            createdBy: user.uid
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
