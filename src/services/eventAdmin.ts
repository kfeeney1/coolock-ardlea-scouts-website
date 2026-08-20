import {
    addDoc,
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc
} from "firebase/firestore";
import type {
    DocumentData,
    QueryDocumentSnapshot,
    Timestamp
} from "firebase/firestore";

import { auth, db } from "../firebase";

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
    "title" | "description" | "eventType" | "section" | "location" |
    "meetingPoint" | "returnDetails" | "leaderNotes" | "startDate" |
    "endDate" | "status" | "consentRequired">;

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

function mapEvent(snapshot: QueryDocumentSnapshot<DocumentData>): EventRecord {
    const data = snapshot.data();
    return {
        id: snapshot.id,
        title: stringValue(data, "title") || "Untitled event",
        description: stringValue(data, "description"),
        eventType: stringValue(data, "eventType") || "Activity",
        section: stringValue(data, "section") || "All Sections",
        location: stringValue(data, "location"),
        meetingPoint: stringValue(data, "meetingPoint"),
        returnDetails: stringValue(data, "returnDetails"),
        leaderNotes: stringValue(data, "leaderNotes"),
        startDate: stringValue(data, "startDate"),
        endDate: stringValue(data, "endDate"),
        status: data.status === "open" || data.status === "closed" || data.status === "completed" ? data.status : "draft",
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

function publicEventFields(event: EventRecord) {
    return {
        eventId: event.id,
        title: event.title,
        description: event.description,
        eventType: event.eventType,
        section: event.section,
        location: event.location,
        startDate: event.startDate,
        endDate: event.endDate,
        status: event.status,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid ?? ""
    };
}

async function syncPublicEvents(events: EventRecord[]): Promise<void> {
    if (!auth.currentUser) return;
    await Promise.all(events.map((event) =>
        setDoc(doc(db, "publicActivities", event.id), publicEventFields(event), { merge: true })
    ));
}

export async function loadEvents(): Promise<EventRecord[]> {
    const snapshot = await getDocs(query(collection(db, "events"), orderBy("startDate", "desc")));
    const events = snapshot.docs.map(mapEvent);
    await syncPublicEvents(events);
    return events;
}

export async function createEvent(input: EventInput): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");
    const title = clean(input.title, 200);
    if (!title) throw new Error("Event title is required.");

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
    return eventRef.id;
}

export async function updateEvent(eventId: string, input: EventInput): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");
    await updateDoc(doc(db, "events", eventId), {
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
}

export async function updateEventRoster(eventId: string, attendance: Record<string, AttendanceStatus>, consent: Record<string, EventConsentStatus>): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");
    await updateDoc(doc(db, "events", eventId), {
        attendance,
        consent,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
    });
}
