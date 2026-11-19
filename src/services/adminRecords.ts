import { ServiceFailure, UserFacingError } from "./applicationErrors.ts";
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
import { readLeaderConsent } from "./leaderConsentRead";
import { activeScoutingAppointments, isGroupLeadershipAppointment, normalizeScoutingAppointmentAssignments } from "../security/scoutingAppointments";

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

function mapConsent({ id, section, data }: Awaited<ReturnType<typeof readLeaderConsent>>[number]): AdminRecord | null {
    const formType = stringValue(data, "formType");
    if (!CONSENT_FORM_TYPES.has(formType) || !section) return null;

    const title = formType === "scouter-es3-medical-advice"
        ? stringValue(data, "name")
        : stringValue(data, "childName");
    if (!title) return null;

    return {
        id,
        kind: "consent",
        submittedAt: timestampToDate(data.submittedAt),
        status: stringValue(data, "status"),
        title,
        subtitle: section,
        data
    };
}

async function scopedDocuments(
    sections: string[]
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
    if (sections.length === 0) return [];

    const snapshots = await Promise.all(
        sections.map((section) =>
            getDocs(query(collection(db, "joinApplications"), where("section", "==", section), limit(200)))
        )
    );
    const byId = new Map<string, QueryDocumentSnapshot<DocumentData>>();
    snapshots.forEach((snapshot) => snapshot.docs.forEach((item) => byId.set(item.id, item)));
    return [...byId.values()];
}

export async function loadAdminRecords(): Promise<AdminRecord[]> {
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");

    const profileSnapshot = await getDoc(doc(db, "adminUsers", user.uid));
    if (!profileSnapshot.exists() || profileSnapshot.data().active !== true) {
        throw new UserFacingError("Active leader profile is required.");
    }

    const profile = profileSnapshot.data();
    const isAdmin = profile.role === "admin" || profile.role === "super-admin";
    const leadershipSnapshot = await getDoc(doc(db, "organisationLeadership", user.uid));
    const leadership = leadershipSnapshot.exists() ? leadershipSnapshot.data() : null;
    const appointments = leadership?.active === true
        ? activeScoutingAppointments(normalizeScoutingAppointmentAssignments(leadership.appointments, leadership.scoutingRole, leadership.organisationSection))
        : [];
    const hasGroupJoinAccess = isAdmin || appointments.some((item) => isGroupLeadershipAppointment(item.appointment));
    const joinSections = [...new Set(appointments
        .filter((item) => item.appointment === "Section Leader" && item.scope !== "Group")
        .map((item) => item.scope))];

    const joinPromise = hasGroupJoinAccess
        ? getDocs(query(collection(db, "joinApplications"), orderBy("submittedAt", "desc"), limit(200))).then((snapshot) => snapshot.docs)
        : joinSections.length > 0 ? scopedDocuments(joinSections) : Promise.resolve([]);
    const [joinDocuments, consentDocuments] = await Promise.all([joinPromise, readLeaderConsent()]);

    return [
        ...joinDocuments.map(mapJoin),
        ...consentDocuments.map(mapConsent).sort((left, right) =>
            (right?.submittedAt?.getTime() ?? 0) - (left?.submittedAt?.getTime() ?? 0)).slice(0, 200)
    ]
        .filter((record): record is AdminRecord => record !== null)
        .sort((left, right) => {
            const leftTime = left.submittedAt?.getTime() ?? 0;
            const rightTime = right.submittedAt?.getTime() ?? 0;
            return rightTime - leftTime;
        });
}

export async function updateRecordStatus(record: AdminRecord, status: string): Promise<void> {
    if (record.kind === "join") {
        throw new UserFacingError("Join Us status changes must be made in Join Us Management.");
    }
    await updateDoc(doc(db, "consentApplications", record.id), { status });
}
