import { readEventDocuments } from "./eventDiscovery";

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
    const audienceSnapshot = await atParentEventOperation("Read selected event audiences", () =>
        readEventDocuments("audienceMembers", [["memberId", "in", linkedMemberIds]]));
    const audienceByEvent = new Map<string, Set<string>>();
    audienceSnapshot.forEach((item) => {
        const data = item.data() as Record<string, unknown>;
        const eventId = value(data, "eventId");
        const memberId = value(data, "memberId");
        if (!eventId || !linkedMemberIds.includes(memberId)) return;
        const members = audienceByEvent.get(eventId) ?? new Set<string>();
        members.add(memberId);
        audienceByEvent.set(eventId, members);
    });

    const upcoming = new Date().toISOString().slice(0, 10);
    const sectionsToRead = [...new Set([...sections, "Group", "All Sections"])];
    const candidates = (await Promise.all([
        ...sectionsToRead.map(section =>
            readEventDocuments("eventConsentLinks", [["section", "==", section], ["active", "==", true]])),
        // Selected audiences can include a child from a different classification section.
        ...[...audienceByEvent.keys()].map(eventId =>
            readEventDocuments("eventConsentLinks", [["eventId", "==", eventId], ["active", "==", true]]))
    ])).flat();
    const events = candidates.flatMap(item => {
        const event = mapLegacyLink(item.id, item.data());
        if (!event) return [];
        const members = audienceByEvent.get(event.eventId);
        if (item.data().audienceVersion === 3 && !members?.size) return [];
        return [{...event, audienceMemberIds: members ? [...members] : event.audienceMemberIds.filter(id => linkedMemberIds.includes(id))}];
    });
    return [...new Map(events
        .filter((event) => event.startDate >= upcoming)
        .map((event) => [event.eventId, event])).values()]
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
