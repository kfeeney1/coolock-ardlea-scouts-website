import { collection, collectionGroup, getDocs, query, where } from "firebase/firestore";

import { db } from "../firebase";
import { loadUpcomingPublicEvents } from "./publicEvents";

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

async function queryParentConsentLinks(eventId: string, version: number, section?: string) {
    try {
        const links = await atParentEventOperation("Read event consent link projections", () => getDocs(query(
            collection(db, "eventConsentLinks"),
            where("eventId", "==", eventId),
            where("active", "==", true),
            where("audienceVersion", "==", version),
            ...(section ? [where("section", "==", section)] : [])
        )));
        return links.docs
            .map(item => mapLegacyLink(item.id, item.data()))
            .filter((event): event is ParentEventConsentLink => event !== null && event.eventId === eventId);
    } catch (error) {
        // Candidate discovery can race a hide, audience change or transfer.
        if ((error as ParentEventReadError).code === "permission-denied") return [];
        throw error;
    }
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
    const [selectedEventGroups, legacyEvents] = await Promise.all([
        Promise.all([...audienceByEvent.entries()].map(async ([eventId, members]) => {
            const links = await queryParentConsentLinks(eventId, 3);
            return links.filter(event => event.consentRequired)
                .map(event => ({ ...event, audienceMemberIds: [...members] }));
        })),
        (async () => {
            // Legacy open section events publish a public schedule projection.
            // Its ID is a lookup candidate only. The consent query checks the
            // canonical event and the parent's current section authorization.
            const legacySections = new Set([...sections, "Group", "All Sections"]);
            const candidates = (await loadUpcomingPublicEvents()).filter(event => legacySections.has(event.section));
            const links = await Promise.all(candidates.flatMap(event =>
                [1, 2].map(version => queryParentConsentLinks(event.id, version, event.section))
            ));
            return links.flat();
        })()
    ]);
    const audienceEvents = selectedEventGroups.flat();

    return [...new Map([...legacyEvents, ...audienceEvents]
        .filter((event) => event.startDate >= upcoming)
        .map((event) => [event.eventId, event])).values()]
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
