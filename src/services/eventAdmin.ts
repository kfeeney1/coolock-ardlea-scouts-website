import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot, Timestamp } from "firebase/firestore";

import { auth, db } from "../firebase";
import { recordAuditEvent } from "./auditLog";
import { canTransitionEventStatus, eventCloseOutIssues } from "./eventLifecycleLogic";
import { normalizeLeaderSections } from "./leaderAccessLogic";

export type EventStatus = "draft" | "open" | "closed" | "completed";
export type AttendanceStatus = "invited" | "attending" | "not-attending";
export type EventConsentStatus = "not-required" | "required" | "received";

export type EventRecord = {
    id: string;
    title: string;
    description: string;
    eventType: string;
    section: string;
    location: string;
    meetingPoint: string;
    returnDetails: string;
    leaderNotes: string;
    startDate: string;
    endDate: string;
    status: EventStatus;
    consentRequired: boolean;
    attendance: Record<string, AttendanceStatus>;
    consent: Record<string, EventConsentStatus>;
    createdAt: Date | null;
    updatedAt: Date | null;
};

export type EventInput = Pick<EventRecord,
    "title" | "description" | "eventType" | "section" | "location" | "meetingPoint" | "returnDetails" |
    "leaderNotes" | "startDate" | "endDate" | "status" | "consentRequired"
>;

const EVENT_STATUSES = ["draft", "open", "closed", "completed"] as const;

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

function mapAttendance(value: unknown): Record<string, AttendanceStatus> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result: Record<string, AttendanceStatus> = {};
    Object.entries(value as Record<string, unknown>).forEach(([memberId, status]) => {
        if (status === "invited" || status === "attending" || status === "not-attending") result[memberId] = status;
    });
    return result;
}

function mapConsent(value: unknown): Record<string, EventConsentStatus> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result: Record<string, EventConsentStatus> = {};
    Object.entries(value as Record<string, unknown>).forEach(([memberId, status]) => {
        if (status === "not-required" || status === "required" || status === "received") result[memberId] = status;
    });
    return result;
}

function mapEvent(snapshot: QueryDocumentSnapshot<DocumentData>): EventRecord | null {
    const data = snapshot.data();
    const title = stringValue(data, "title");
    const eventType = stringValue(data, "eventType");
    const section = stringValue(data, "section");
    const startDate = stringValue(data, "startDate");
    const endDate = stringValue(data, "endDate");
    const status = data.status as EventStatus;
    if (!title || !eventType || !section || !startDate || !endDate || !EVENT_STATUSES.includes(status)) return null;

    return {
        id: snapshot.id,
        title,
        description: stringValue(data, "description"),
        eventType,
        section,
        location: stringValue(data, "location"),
        meetingPoint: stringValue(data, "meetingPoint"),
        returnDetails: stringValue(data, "returnDetails"),
        leaderNotes: stringValue(data, "leaderNotes"),
        startDate,
        endDate,
        status,
        consentRequired: data.consentRequired === true,
        attendance: mapAttendance(data.attendance),
        consent: mapConsent(data.consent),
        createdAt: timestampToDate(data.createdAt),
        updatedAt: timestampToDate(data.updatedAt)
    };
}

function clean(value: string, max: number): string {
    return value.trim().slice(0, max);
}

async function syncPublicEvent(eventId: string, input: EventInput): Promise<void> {
    const publicRef = doc(db, "publicEvents", eventId);
    if (input.status !== "open") {
        await deleteDoc(publicRef);
        return;
    }

    await setDoc(publicRef, {
        eventId,
        title: clean(input.title, 200),
        description: clean(input.description, 3000),
        eventType: clean(input.eventType, 80),
        section: clean(input.section, 80),
        location: clean(input.location, 300),
        startDate: clean(input.startDate, 30),
        endDate: clean(input.endDate, 30),
        updatedAt: serverTimestamp()
    });
}

export async function loadEvents(): Promise<EventRecord[]> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");

    const profileSnapshot = await getDoc(doc(db, "adminUsers", user.uid));
    if (!profileSnapshot.exists() || profileSnapshot.data().active !== true) throw new Error("Active leader profile is required.");

    const profile = profileSnapshot.data();
    const isAdmin = profile.role === "admin" || profile.role === "super-admin";
    const docs = isAdmin
        ? (await getDocs(query(collection(db, "events"), orderBy("startDate", "desc")))).docs
        : (await Promise.all(
            normalizeLeaderSections(profile).map((section) =>
                getDocs(query(collection(db, "events"), where("section", "==", section)))
            )
          )).flatMap((snapshot) => snapshot.docs);

    return docs
        .map(mapEvent)
        .filter((event): event is EventRecord => event !== null)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function createEvent(input: EventInput): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");
    const title = clean(input.title, 200);
    if (!title) throw new Error("Event title is required.");
    if (input.status !== "draft" && input.status !== "open") throw new Error("New events must start as Draft or Open.");

    const eventRef = await addDoc(collection(db, "events"), {
        title,
        description: clean(input.description, 3000),
        eventType: clean(input.eventType, 80),
        section: clean(input.section, 80),
        location: clean(input.location, 300),
        meetingPoint: clean(input.meetingPoint, 500),
        returnDetails: clean(input.returnDetails, 500),
        leaderNotes: clean(input.leaderNotes, 3000),
        startDate: clean(input.startDate, 30),
        endDate: clean(input.endDate, 30),
        status: input.status,
        consentRequired: input.consentRequired,
        attendance: {},
        consent: {},
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
    });

    await syncPublicEvent(eventRef.id, { ...input, title });
    await recordAuditEvent({
        category: "event",
        action: "Event created",
        targetId: eventRef.id,
        targetLabel: title,
        section: clean(input.section, 80),
        description: `Created event with status ${input.status}${input.consentRequired ? "; consent required" : ""}.`
    });
    return eventRef.id;
}

export async function updateEvent(eventId: string, input: EventInput): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");

    const eventRef = doc(db, "events", eventId);
    const currentSnapshot = await getDoc(eventRef);
    if (!currentSnapshot.exists()) throw new Error("Event not found.");
    const current = currentSnapshot.data();
    const currentStatus = current.status as EventStatus;
    if (!EVENT_STATUSES.includes(currentStatus)) throw new Error("Event has an invalid current status.");
    if (!canTransitionEventStatus(currentStatus, input.status)) {
        throw new Error(`Event status cannot move directly from ${currentStatus} to ${input.status}.`);
    }
    if (input.status === "completed") {
        const issues = eventCloseOutIssues({
            status: currentStatus,
            consentRequired: current.consentRequired === true,
            attendance: mapAttendance(current.attendance),
            consent: mapConsent(current.consent)
        });
        if (issues.length > 0) throw new Error(issues.join(" "));
    }

    await updateDoc(eventRef, {
        title: clean(input.title, 200),
        description: clean(input.description, 3000),
        eventType: clean(input.eventType, 80),
        section: clean(input.section, 80),
        location: clean(input.location, 300),
        meetingPoint: clean(input.meetingPoint, 500),
        returnDetails: clean(input.returnDetails, 500),
        leaderNotes: clean(input.leaderNotes, 3000),
        startDate: clean(input.startDate, 30),
        endDate: clean(input.endDate, 30),
        status: input.status,
        consentRequired: input.consentRequired,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
    });

    await syncPublicEvent(eventId, input);
    await recordAuditEvent({
        category: "event",
        action: input.status === "completed" ? "Event completed" : "Event updated",
        targetId: eventId,
        targetLabel: clean(input.title, 200),
        section: clean(input.section, 80),
        description: input.status === "completed"
            ? "Completed event after attendance and consent close-out checks passed."
            : `Updated event; status is ${input.status}${input.consentRequired ? "; consent required" : ""}.`
    });
}

export async function updateEventRoster(
    eventId: string,
    attendance: Record<string, AttendanceStatus>,
    consent: Record<string, EventConsentStatus>
): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");

    const eventRef = doc(db, "events", eventId);
    const currentSnapshot = await getDoc(eventRef);
    if (!currentSnapshot.exists()) throw new Error("Event not found.");
    if (currentSnapshot.data().status === "completed") throw new Error("Completed event rosters are read-only.");

    await updateDoc(eventRef, {
        attendance,
        consent,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
    });

    await recordAuditEvent({
        category: "event",
        action: "Event roster updated",
        targetId: eventId,
        targetLabel: eventId,
        section: "",
        description: `Updated attendance/consent status for ${Object.keys(attendance).length} roster member${Object.keys(attendance).length === 1 ? "" : "s"}.`
    });
}