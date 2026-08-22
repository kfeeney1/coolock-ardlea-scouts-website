import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    updateDoc,
    where
} from "firebase/firestore";
import type {
    DocumentData,
    QueryDocumentSnapshot,
    Timestamp
} from "firebase/firestore";

import { auth, db } from "../firebase";

export type RecordKind = "join" | "consent";

export type AdminRecord = {
    id: string;
    kind: RecordKind;
    submittedAt: Date | null;
    status: string;
    title: string;
    subtitle: string;
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
    return typeof value === "string" ? value : "";
}

function profileSections(data: DocumentData): string[] {
    const sections = Array.isArray(data.sections)
        ? data.sections.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
    const legacy = stringValue(data, "section").trim();
    return [...new Set([...sections.map((section) => section.trim()), legacy].filter(Boolean))];
}

function mapJoin(snapshot: QueryDocumentSnapshot<DocumentData>): AdminRecord {
    const data = snapshot.data();
    const childName = [stringValue(data, "childFirstName"), stringValue(data, "childLastName")]
        .filter(Boolean)
        .join(" ");

    return {
        id: snapshot.id,
        kind: "join",
        submittedAt: timestampToDate(data.submittedAt),
        status: stringValue(data, "status") || "new",
        title: childName || "Join application",
        subtitle: stringValue(data, "section") || stringValue(data, "emailAddress"),
        data
    };
}

function mapConsent(snapshot: QueryDocumentSnapshot<DocumentData>): AdminRecord {
    const data = snapshot.data();
    const formType = stringValue(data, "formType");
    const title = formType === "scouter-es3-medical-advice"
        ? stringValue(data, "name") || "Scouter ES3"
        : stringValue(data, "childName") || "Youth consent";

    return {
        id: snapshot.id,
        kind: "consent",
        submittedAt: timestampToDate(data.submittedAt),
        status: stringValue(data, "status") || "active",
        title,
        subtitle: stringValue(data, "section") || stringValue(data, "scoutSection") || formType,
        data
    };
}

async function scopedDocuments(
    collectionName: "joinApplications" | "consentApplications",
    sections: string[]
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
    if (sections.length === 0) return [];

    const reads = collectionName === "joinApplications"
        ? sections.map((section) =>
              getDocs(query(collection(db, collectionName), where("section", "==", section), limit(200)))
          )
        : sections.flatMap((section) => [
              getDocs(query(collection(db, collectionName), where("section", "==", section), limit(200))),
              getDocs(query(collection(db, collectionName), where("scoutSection", "==", section), limit(200)))
          ]);

    const snapshots = await Promise.all(reads);
    const byId = new Map<string, QueryDocumentSnapshot<DocumentData>>();
    snapshots.forEach((snapshot) => snapshot.docs.forEach((item) => byId.set(item.id, item)));
    return [...byId.values()];
}

export async function loadAdminRecords(): Promise<AdminRecord[]> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");

    const profileSnapshot = await getDoc(doc(db, "adminUsers", user.uid));
    if (!profileSnapshot.exists() || profileSnapshot.data().active !== true) {
        throw new Error("Active leader profile is required.");
    }

    const profile = profileSnapshot.data();
    const isAdmin = profile.role === "admin" || profile.role === "super-admin";
    const sections = profileSections(profile);

    const [joinDocuments, consentDocuments] = isAdmin
        ? await Promise.all([
              getDocs(query(collection(db, "joinApplications"), orderBy("submittedAt", "desc"), limit(200))).then((snapshot) => snapshot.docs),
              getDocs(query(collection(db, "consentApplications"), orderBy("submittedAt", "desc"), limit(200))).then((snapshot) => snapshot.docs)
          ])
        : await Promise.all([
              scopedDocuments("joinApplications", sections),
              scopedDocuments("consentApplications", sections)
          ]);

    return [
        ...joinDocuments.map(mapJoin),
        ...consentDocuments.map(mapConsent)
    ].sort((left, right) => {
        const leftTime = left.submittedAt?.getTime() ?? 0;
        const rightTime = right.submittedAt?.getTime() ?? 0;
        return rightTime - leftTime;
    });
}

export async function updateRecordStatus(record: AdminRecord, status: string): Promise<void> {
    const collectionName = record.kind === "join" ? "joinApplications" : "consentApplications";
    await updateDoc(doc(db, collectionName, record.id), { status });
}
