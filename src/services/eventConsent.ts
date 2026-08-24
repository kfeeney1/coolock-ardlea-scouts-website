import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from "firebase/firestore";
import type { DocumentData, Timestamp } from "firebase/firestore";

import { auth, db } from "../firebase";
import type { EventRecord } from "./eventAdmin";
import { normalizeLeaderSections } from "./leaderAccessLogic";

export type ResponseProcessingStatus = "new" | "matched" | "ignored";

export type PublicEventLink = {
    token: string;
    eventId: string;
    title: string;
    description: string;
    eventType: string;
    section: string;
    location: string;
    meetingPoint: string;
    returnDetails: string;
    startDate: string;
    endDate: string;
    consentRequired: boolean;
    active: boolean;
    createdAt: Date | null;
    updatedAt: Date | null;
};

export type EventConsentResponse = {
    id: string;
    token: string;
    eventId: string;
    childName: string;
    dateOfBirth: string;
    parentName: string;
    attendance: "attending" | "not-attending";
    consentGiven: boolean;
    emergencyDetailsConfirmed: boolean;
    medicalDetailsChanged: boolean;
    processingStatus: ResponseProcessingStatus;
    matchedMemberId: string;
    processedBy: string;
    processedAt: Date | null;
    submittedAt: Date | null;
};

export type SubmitEventConsentInput = Omit<
    EventConsentResponse,
    "id" | "processingStatus" | "matchedMemberId" | "processedBy" | "processedAt" | "submittedAt"
>;

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

async function currentLeaderProfile(): Promise<DocumentData> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");

    const snapshot = await getDoc(doc(db, "adminUsers", user.uid));
    if (!snapshot.exists() || snapshot.data().active !== true) throw new Error("Active leader profile is required.");
    return snapshot.data();
}

function mapLink(token: string, data: DocumentData): PublicEventLink | null {
    const eventId = stringValue(data, "eventId");
    const title = stringValue(data, "title");
    const eventType = stringValue(data, "eventType");
    const section = stringValue(data, "section");
    const startDate = stringValue(data, "startDate");
    const endDate = stringValue(data, "endDate");
    if (!eventId || !title || !eventType || !section || !startDate || !endDate || typeof data.active !== "boolean") return null;

    return {
        token,
        eventId,
        title,
        description: stringValue(data, "description"),
        eventType,
        section,
        location: stringValue(data, "location"),
        meetingPoint: stringValue(data, "meetingPoint"),
        returnDetails: stringValue(data, "returnDetails"),
        startDate,
        endDate,
        consentRequired: data.consentRequired === true,
        active: data.active === true,
        createdAt: timestampToDate(data.createdAt),
        updatedAt: timestampToDate(data.updatedAt)
    };
}

function mapResponse(id: string, data: DocumentData): EventConsentResponse | null {
    const processingStatus = data.processingStatus as ResponseProcessingStatus;
    const attendance = data.attendance as "attending" | "not-attending";
    const token = stringValue(data, "token");
    const eventId = stringValue(data, "eventId");
    const childName = stringValue(data, "childName");
    const dateOfBirth = stringValue(data, "dateOfBirth");
    const parentName = stringValue(data, "parentName");
    if (
        !["new", "matched", "ignored"].includes(processingStatus) ||
        !["attending", "not-attending"].includes(attendance) ||
        !token || !eventId || !childName || !dateOfBirth || !parentName
    ) return null;

    return {
        id,
        token,
        eventId,
        childName,
        dateOfBirth,
        parentName,
        attendance,
        consentGiven: data.consentGiven === true,
        emergencyDetailsConfirmed: data.emergencyDetailsConfirmed === true,
        medicalDetailsChanged: data.medicalDetailsChanged === true,
        processingStatus,
        matchedMemberId: stringValue(data, "matchedMemberId"),
        processedBy: stringValue(data, "processedBy"),
        processedAt: timestampToDate(data.processedAt),
        submittedAt: timestampToDate(data.submittedAt)
    };
}

function clean(value: string, max: number): string {
    return value.trim().slice(0, max);
}

function publicEventPayload(event: EventRecord) {
    return {
        eventId: event.id,
        title: clean(event.title, 200),
        description: clean(event.description, 1500),
        eventType: clean(event.eventType, 80),
        section: clean(event.section, 80),
        location: clean(event.location, 300),
        meetingPoint: clean(event.meetingPoint, 500),
        returnDetails: clean(event.returnDetails, 500),
        startDate: clean(event.startDate, 30),
        endDate: clean(event.endDate, 30),
        consentRequired: event.consentRequired,
        active: event.status === "open" && event.consentRequired,
        updatedAt: serverTimestamp()
    };
}

export async function ensurePublicEventLink(event: EventRecord): Promise<PublicEventLink> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");

    const existing = await getDocs(
        query(collection(db, "eventConsentLinks"), where("eventId", "==", event.id), where("section", "==", event.section))
    );

    if (!existing.empty) {
        const snapshot = existing.docs[0];
        await setDoc(snapshot.ref, publicEventPayload(event), { merge: true });
        const refreshed = await getDoc(snapshot.ref);
        const mapped = mapLink(refreshed.id, refreshed.data() || {});
        if (!mapped) throw new Error("Event consent link does not match the canonical data contract.");
        return mapped;
    }

    const token = crypto.randomUUID().replaceAll("-", "");
    const linkRef = doc(db, "eventConsentLinks", token);
    await setDoc(linkRef, {
        ...publicEventPayload(event),
        createdAt: serverTimestamp(),
        createdBy: user.uid
    });
    const created = await getDoc(linkRef);
    const mapped = mapLink(created.id, created.data() || {});
    if (!mapped) throw new Error("New event consent link does not match the canonical data contract.");
    return mapped;
}

export async function loadEventConsentLinks(): Promise<PublicEventLink[]> {
    const profile = await currentLeaderProfile();
    const isAdmin = profile.role === "admin" || profile.role === "super-admin";

    const docs = isAdmin
        ? (await getDocs(collection(db, "eventConsentLinks"))).docs
        : (await Promise.all(
            normalizeLeaderSections(profile).map((section) =>
                getDocs(query(collection(db, "eventConsentLinks"), where("section", "==", section)))
            )
          )).flatMap((snapshot) => snapshot.docs);

    return docs
        .map((item) => mapLink(item.id, item.data()))
        .filter((link): link is PublicEventLink => link !== null);
}

export async function loadPublicEventLink(token: string): Promise<PublicEventLink | null> {
    const snapshot = await getDoc(doc(db, "eventConsentLinks", token));
    if (!snapshot.exists()) return null;
    return mapLink(snapshot.id, snapshot.data());
}

export async function submitEventConsentResponse(input: SubmitEventConsentInput): Promise<string> {
    const responseRef = await addDoc(collection(db, "eventConsentResponses"), {
        token: clean(input.token, 100),
        eventId: clean(input.eventId, 100),
        childName: clean(input.childName, 200),
        dateOfBirth: clean(input.dateOfBirth, 20),
        parentName: clean(input.parentName, 200),
        attendance: input.attendance,
        consentGiven: input.consentGiven,
        emergencyDetailsConfirmed: input.emergencyDetailsConfirmed,
        medicalDetailsChanged: input.medicalDetailsChanged,
        processingStatus: "new",
        submittedAt: serverTimestamp()
    });
    return responseRef.id;
}

export async function loadEventConsentResponses(eventId: string): Promise<EventConsentResponse[]> {
    const profile = await currentLeaderProfile();
    const isAdmin = profile.role === "admin" || profile.role === "super-admin";
    if (!isAdmin) return [];

    const snapshot = await getDocs(query(collection(db, "eventConsentResponses"), where("eventId", "==", eventId)));
    return snapshot.docs
        .map((item) => mapResponse(item.id, item.data()))
        .filter((response): response is EventConsentResponse => response !== null)
        .sort((a, b) => (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0));
}

export async function markEventConsentResponseMatched(responseId: string, memberId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");

    await updateDoc(doc(db, "eventConsentResponses", responseId), {
        processingStatus: "matched",
        matchedMemberId: clean(memberId, 100),
        processedBy: user.uid,
        processedAt: serverTimestamp()
    });
}

export async function ignoreEventConsentResponse(responseId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in leader.");

    await updateDoc(doc(db, "eventConsentResponses", responseId), {
        processingStatus: "ignored",
        matchedMemberId: "",
        processedBy: user.uid,
        processedAt: serverTimestamp()
    });
}
