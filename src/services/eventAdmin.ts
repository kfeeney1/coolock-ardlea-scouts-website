import { ServiceFailure, UserFacingError } from "./applicationErrors.ts";
import {
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
import { loadMembers } from "./memberAdmin";
import { buildEventAudienceMemberships, shouldPreserveLegacyEventAudience } from "./eventAudienceMemberships";
import { buildEventAudience, defaultEventAudienceForClassification } from "./eventManagementLogic";
import { MEMBER_PROGRAMME_SECTIONS, canonicalMemberSection } from "./memberSectionCore.mjs";
import { saveEventAudience } from "./emailNotifications";

export type EventStatus = "draft" | "open" | "closed" | "completed";
export type AttendanceStatus = "invited" | "attending" | "not-attending";
export type EventConsentStatus = "not-required" | "required" | "received";
export type EventAudience = { version: 1 | 2 | 3; mode: "sections" | "members" | "mixed"; semantics: "snapshot"; sectionIds: string[]; memberIds: string[]; resolvedMemberIds: string[] };

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
    consentLinkToken: string;
    attendance: Record<string, AttendanceStatus>;
    consent: Record<string, EventConsentStatus>;
    audience: EventAudience | null;
    createdAt: Date | null;
    updatedAt: Date | null;
};

export type EventInput = Pick<EventRecord,
    "title" | "description" | "eventType" | "section" | "location" | "meetingPoint" | "returnDetails" |
    "leaderNotes" | "startDate" | "endDate" | "status" | "consentRequired"
> & { audience: EventAudience | null };

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

function mapAudience(value: unknown): EventAudience | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const data = value as Record<string, unknown>;
    const ids = (item: unknown) => Array.isArray(item)
        ? [...new Set(item.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())).map((entry) => entry.trim()))]
        : [];
    if (data.version !== 1 && data.version !== 2 && data.version !== 3) return null;
    const sectionIds = ids(data.sectionIds);
    const memberIds = ids(data.memberIds);
    const resolvedMemberIds = ids(data.resolvedMemberIds);
    const mode = data.version === 3 && (data.mode === "sections" || data.mode === "members" || data.mode === "mixed")
        ? data.mode
        : sectionIds.length > 0 && memberIds.length > 0 ? "mixed" : memberIds.length > 0 ? "members" : "sections";
    // Version 1 was already a persisted resolved-member snapshot in practice. Normalise it
    // to v2 on read without rewriting the production record until the event is next saved.
    return { version: data.version === 3 ? 3 : 2, mode, semantics: "snapshot", sectionIds, memberIds, resolvedMemberIds };
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
        consentLinkToken: stringValue(data, "consentLinkToken"),
        attendance: mapAttendance(data.attendance),
        consent: mapConsent(data.consent),
        audience: mapAudience(data.audience),
        createdAt: timestampToDate(data.createdAt),
        updatedAt: timestampToDate(data.updatedAt)
    };
}

function clean(value: string, max: number): string {
    return value.trim().slice(0, max);
}

async function authorisedEventAudienceSections(userId: string): Promise<string[]> {
    const profile = await getDoc(doc(db, "adminUsers", userId));
    if (!profile.exists() || profile.data().active !== true) throw new UserFacingError("Active leader profile is required.");
    const data = profile.data();
    if (data.role === "admin" || data.role === "super-admin") return [...MEMBER_PROGRAMME_SECTIONS];
    return normalizeLeaderSections(data).map(canonicalMemberSection).filter((section) => section !== "Group");
}

function galleryProjection(eventId: string, input: EventInput) {
    return {
        eventId,
        title: clean(input.title, 200),
        description: clean(input.description, 3000),
        eventType: clean(input.eventType, 80),
        section: clean(input.section, 80),
        location: clean(input.location, 300),
        startDate: clean(input.startDate, 30),
        endDate: clean(input.endDate, 30),
        status: input.status,
        updatedAt: serverTimestamp()
    };
}

async function syncPublicEvent(eventId: string, input: EventInput): Promise<void> {
    const publicRef = doc(db, "publicEvents", eventId);
    if (input.status !== "open" || input.audience?.mode === "members" || input.audience?.mode === "mixed") {
        await deleteDoc(publicRef);
        return;
    }

    const { status: _status, ...publicProjection } = galleryProjection(eventId, input);
    void _status;
    await setDoc(publicRef, publicProjection);
}

async function syncParentGalleryEvent(eventId: string, input: EventInput): Promise<void> {
    const galleryRef = doc(db, "parentGalleryEvents", eventId);
    const audienceIncludesClassificationSection = !input.audience
        || input.section === "All Sections"
        || input.audience.sectionIds.includes(input.section);
    if (input.status === "draft"
        || input.audience?.mode === "members"
        || input.audience?.mode === "mixed"
        || !audienceIncludesClassificationSection) {
        await deleteDoc(galleryRef);
        return;
    }
    await setDoc(galleryRef, galleryProjection(eventId, input));
}

async function syncEventProjections(eventId: string, input: EventInput): Promise<void> {
    await Promise.all([
        syncPublicEvent(eventId, input),
        syncParentGalleryEvent(eventId, input)
    ]);
}

export async function loadEvents(): Promise<EventRecord[]> {
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");

    const profileSnapshot = await getDoc(doc(db, "adminUsers", user.uid));
    if (!profileSnapshot.exists() || profileSnapshot.data().active !== true) throw new UserFacingError("Active leader profile is required.");

    const profile = profileSnapshot.data();
    const isAdmin = profile.role === "admin" || profile.role === "super-admin";
    const docs = isAdmin
        ? (await getDocs(query(collection(db, "events"), orderBy("startDate", "desc")))).docs
        : (await Promise.all(
            normalizeLeaderSections(profile).map((section) =>
                getDocs(query(collection(db, "events"), where("section", "==", section)))
            )
          )).flatMap((snapshot) => snapshot.docs);

    const events = docs
        .map(mapEvent)
        .filter((event): event is EventRecord => event !== null)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));

    const targeted = events.filter((event) => event.audience?.version === 3);
    const membershipSnapshots = await Promise.all(targeted.map((event) =>
        getDocs(query(collection(db, "events", event.id, "audienceMembers"), where("eventId", "==", event.id)))
    ));
    const membershipsByEvent = new Map<string, Array<{ memberId: string; selectedIndividually: boolean }>>();
    membershipSnapshots.forEach((snapshot, index) => {
        const eventId = targeted[index].id;
        membershipsByEvent.set(eventId, snapshot.docs.map((item) => ({
            memberId: typeof item.data().memberId === "string" ? item.data().memberId : item.id,
            selectedIndividually: item.data().selectedIndividually === true
        })));
    });

    return events.map((event) => {
        if (event.audience?.version !== 3) return event;
        const memberships = membershipsByEvent.get(event.id) ?? [];
        const resolvedMemberIds = [...new Set(memberships.map((membership) => membership.memberId).filter(Boolean))];
        const memberIds = [...new Set(memberships.filter((membership) => membership.selectedIndividually).map((membership) => membership.memberId).filter(Boolean))];
        const mode = event.audience.mode;
        return { ...event, audience: { ...event.audience, mode, memberIds, resolvedMemberIds } };
    });
}

export async function createEvent(input: EventInput, eventId?: string, onEventIdAllocated?: (id: string) => void): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");
    const title = clean(input.title, 200);
    if (!title) throw new UserFacingError("Event title is required.");
    if (input.status !== "draft" && input.status !== "open") throw new UserFacingError("New events must start as Draft or Open.");

    const [loadedMembers, authorisedSections] = await Promise.all([loadMembers(), authorisedEventAudienceSections(user.uid)]);
    const members = loadedMembers.filter((member) => member.status === "active");
    const canonicalAudience = buildEventAudience(input.audience?.sectionIds ?? [], input.audience?.memberIds ?? [], members);
    if (canonicalAudience.resolvedMemberIds.length === 0) throw new UserFacingError("Choose at least one active, authorised member for this event audience.");
    if (canonicalAudience.resolvedMemberIds.length > 450) throw new UserFacingError("An event audience cannot exceed 450 active members.");
    const eventRef = eventId ? doc(db, "events", eventId) : doc(collection(db, "events"));
    onEventIdAllocated?.(eventRef.id);
    const memberships = buildEventAudienceMemberships(eventRef.id, clean(input.section, 80), canonicalAudience, members, authorisedSections);
    if (memberships.length !== canonicalAudience.resolvedMemberIds.length) throw new UserFacingError("The event audience includes a member who is no longer active or is outside your authorised scope.");

    await saveEventAudience("create", eventRef.id, input as unknown as Record<string, unknown>, {
        sectionIds: canonicalAudience.sectionIds,
        memberIds: canonicalAudience.memberIds
    });

    await syncEventProjections(eventRef.id, { ...input, title, audience: canonicalAudience });
    return eventRef.id;
}

export async function updateEvent(eventId: string, input: EventInput, removalsConfirmed = false): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");

    const eventRef = doc(db, "events", eventId);
    const currentSnapshot = await getDoc(eventRef);
    if (!currentSnapshot.exists()) throw new UserFacingError("Event not found.");
    const current = currentSnapshot.data();
    const currentStatus = current.status as EventStatus;
    if (!EVENT_STATUSES.includes(currentStatus)) throw new UserFacingError("Event has an invalid current status.");
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

    const loadedMembers = await loadMembers();
    const members = loadedMembers.filter((member) => member.status === "active");
    const visibleAudience = buildEventAudience(input.audience?.sectionIds ?? [], input.audience?.memberIds ?? [], members);
    const currentAudience = mapAudience(current.audience);
    const preserveLegacyAudience = shouldPreserveLegacyEventAudience(
        currentAudience,
        input.audience,
        defaultEventAudienceForClassification(clean(current.section, 80), members)
    );
    const preservedAudience = currentAudience ?? defaultEventAudienceForClassification(clean(current.section, 80), members);
    const canonicalAudience = visibleAudience;
    if (canonicalAudience.resolvedMemberIds.length === 0) throw new UserFacingError("Choose at least one active, authorised member for this event audience.");
    if (canonicalAudience.resolvedMemberIds.length > 450) throw new UserFacingError("An event audience cannot exceed 450 active members.");
    await saveEventAudience("update", eventId, input as unknown as Record<string, unknown>, {
        sectionIds: preserveLegacyAudience ? (currentAudience?.sectionIds ?? []) : canonicalAudience.sectionIds,
        memberIds: preserveLegacyAudience ? (currentAudience?.memberIds ?? []) : canonicalAudience.memberIds
    }, removalsConfirmed, preserveLegacyAudience && currentAudience?.version !== 3);

    await syncEventProjections(eventId, { ...input, audience: preserveLegacyAudience ? (current.audience ? preservedAudience : null) : canonicalAudience });
}

export async function updateEventRoster(
    eventId: string,
    attendance: Record<string, AttendanceStatus>,
    consent: Record<string, EventConsentStatus>
): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");

    const eventRef = doc(db, "events", eventId);
    const currentSnapshot = await getDoc(eventRef);
    if (!currentSnapshot.exists()) throw new UserFacingError("Event not found.");
    if (currentSnapshot.data().status === "completed") throw new UserFacingError("Completed event rosters are read-only.");

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
