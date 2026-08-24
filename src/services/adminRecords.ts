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
import { normalizeLeaderSections } from "./leaderAccessLogic";

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

const JOIN_STATUSES = new Set(["new", "contacted", "waiting-list", "accepted", "closed"]);
const CONSENT_FORM_TYPES = new Set(["youth-activity-consent", "scouter-es3-medical-advice"]);

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

function mapJoin(snapshot: QueryDocumentSnapshot<DocumentData>): AdminRecord | null {
    const data = snapshot.data();
    const status = stringValue(data, "status");
    if (!JOIN_STATUSES.has(status)) return null;

    const firstName = stringValue(data, "childFirstName");
    const lastName = stringValue(data, "childLastName");
    const section = stringValue(data, "section");
    if (!firstName || !lastName || !section) return null;

    return {
        id: snapshot.id,
        kind: "join",
        submittedAt: timestampToDate(data.submittedAt),
        status,
        title: `${firstName} ${lastName}`.trim(),
        subtitle: section,
        data
    };
}

function mapConsent(snapshot: QueryDocumentSnapshot<DocumentData>): AdminRecord | null {
    const data = snapshot.data();
    const formType = stringValue(data, "formType");
    const section = stringValue(data, "section");
    if (!CONSENT_FORM_TYPES.has(formType) || !section) return null;

    const title = formType === "scouter-es3-medical-advice"
        ? stringValue(data, "name")
        : stringValue(data, "childName");
    if (!title) return null;

    return {
        id: snapshot.id,
        kind: "consent",
        submittedAt: timestampToDate(data.submittedAt),
        status: stringValue(data, "status"),
        title,
        subtitle: section,
        data
    };
}

async function scopedDocuments(
    collectionName: "joinApplications" | "consentApplications",
    sections: string[]
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
    if (sections.length === 0) return [];

    const snapshots = await Promise.all(
        sections.map((section) =>
            getDocs(query(collection(db, collectionName), where("section", "==", section), limit(200)))
        )
    );
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
    const sections = normalizeLeaderSections(profile);

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
    ]
        .filter((record): record is AdminRecord => record !== null)
        .sort((left, right) => {
            const leftTime = left.submittedAt?.getTime() ?? 0;
            const rightTime = right.submittedAt?.getTime() ?? 0;
            return rightTime - leftTime;
        });
}

export async function updateRecordStatus(record: AdminRecord, status: string): Promise<void> {
    const collectionName = record.kind === "join" ? "joinApplications" : "consentApplications";
    await updateDoc(doc(db, collectionName, record.id), { status });
}
