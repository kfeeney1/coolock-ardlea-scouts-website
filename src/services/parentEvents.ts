import { collection, collectionGroup, doc, getDoc, getDocs, query, where } from "firebase/firestore";

import { db } from "../firebase";

export type ParentEventConsentLink = {
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
    audienceMemberIds: string[];
};

function value(data: Record<string, unknown>, key: string): string {
    return typeof data[key] === "string" ? data[key] as string : "";
}

type ParentEventReadError = Error & { code?: string; parentEventOperation?: string };

async function atParentEventOperation<T>(operation: string, read: () => Promise<T>): Promise<T> {
    try {
        return await read();
    } catch (cause) {
        const error = new Error(`${operation} failed`, { cause }) as ParentEventReadError;
        const code = cause && typeof cause === "object" && "code" in cause ? Reflect.get(cause, "code") : undefined;
        if (typeof code === "string") error.code = code;
        error.parentEventOperation = operation;
        throw error;
    }
}

function mapLegacyLink(id: string, data: Record<string, unknown>): ParentEventConsentLink | null {
    const audienceMemberIds = Array.isArray(data.audienceMemberIds)
        ? data.audienceMemberIds.filter((memberId): memberId is string => typeof memberId === "string")
        : [];
    const link = {
        token: id,
        eventId: value(data, "eventId"),
        title: value(data, "title"),
        description: value(data, "description"),
        eventType: value(data, "eventType"),
        section: value(data, "section"),
        location: value(data, "location"),
        meetingPoint: value(data, "meetingPoint"),
        returnDetails: value(data, "returnDetails"),
        startDate: value(data, "startDate"),
        endDate: value(data, "endDate"),
        consentRequired: data.consentRequired === true,
        audienceMemberIds,
    };
    return link.eventId && link.title && link.startDate ? link : null;
}

export async function loadParentEventConsentLinks(memberIds: string[], sections: string[] = []): Promise<ParentEventConsentLink[]> {
    const linkedMemberIds = [...new Set(memberIds.filter(Boolean))].slice(0, 8);
    if (linkedMemberIds.length === 0) return [];

    // New event audiences are read through their per-member audience records.
    // Firestore Rules authorize each result against the approved parent-child link.
    const audienceSnapshot = await atParentEventOperation("Query selected event audience membership records", () => getDocs(query(
        collectionGroup(db, "audienceMembers"),
        where("memberId", "in", linkedMemberIds)
    )));
    const audienceByEvent = new Map<string, Set<string>>();
    audienceSnapshot.docs.forEach((item) => {
        const data = item.data() as Record<string, unknown>;
        const eventId = value(data, "eventId");
        const memberId = value(data, "memberId");
        if (!eventId || !linkedMemberIds.includes(memberId)) return;
        const members = audienceByEvent.get(eventId) ?? new Set<string>();
        members.add(memberId);
        audienceByEvent.set(eventId, members);
    });

    const upcoming = new Date().toISOString().slice(0, 10);
    const selectedEventGroups = await Promise.all([...audienceByEvent.entries()].map(async ([eventId, members]) => {
        const links = await atParentEventOperation("Read selected event consent link projections", () => getDocs(query(
            collection(db, "eventConsentLinks"),
            where("eventId", "==", eventId),
            where("active", "==", true),
            where("audienceVersion", "==", 3)
        )));
        return links.docs.flatMap((item) => {
            const event = mapLegacyLink(item.id, item.data() as Record<string, unknown>);
            return event && event.eventId === eventId && event.consentRequired && event.startDate >= upcoming
                ? [{ ...event, audienceMemberIds: [...members] }]
                : [];
        });
    }));
    const audienceEvents = selectedEventGroups.flat();

    // Preserve access to consent links created before audience membership records
    // were introduced. New v3 links keep their child IDs out of the public token doc.
    const legacySections = [...new Set([...sections.filter(Boolean), "Group", "All Sections"])];
    const legacySnapshots = legacySections.length ? await Promise.all([1, 2].map((version) => atParentEventOperation(
        `Query legacy parent event links version ${version}`,
        () => getDocs(query(
            collection(db, "eventConsentLinks"),
            where("active", "==", true),
            where("audienceVersion", "==", version),
            where("section", "in", legacySections)
        ))
    ))) : [];
    const legacyEvents = legacySnapshots.flatMap((snapshot) => snapshot.docs
        .map((item) => mapLegacyLink(item.id, item.data() as Record<string, unknown>)))
        .filter((event): event is ParentEventConsentLink => Boolean(event));

    return [...new Map([...audienceEvents.filter((event): event is ParentEventConsentLink => Boolean(event)), ...legacyEvents]
        .filter((event) => event.startDate >= upcoming)
        .map((event) => [event.eventId, event])).values()]
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
