import type { ParentConsentRecord, ParentLinkedMember } from "./parentConsent";
import type { ParentEventConsentLink } from "./parentEvents";

export type ParentTaskSummary = {
    eventConsentCount: number;
    medicalAttentionCount: number;
    upcomingEventCount: number;
    totalAttentionCount: number;
    nextEvent: ParentEventConsentLink | null;
    nextConsentEvent: ParentEventConsentLink | null;
};

export function summariseParentTasks(
    events: ParentEventConsentLink[],
    members: ParentLinkedMember[],
    consents: ParentConsentRecord[]
): ParentTaskSummary {
    const recordsByMember = new Map<string, ParentConsentRecord[]>();
    for (const consent of consents) {
        recordsByMember.set(consent.memberId, [
            ...(recordsByMember.get(consent.memberId) || []),
            consent
        ]);
    }

    const medicalAttentionCount = members.filter((member) => {
        const records = recordsByMember.get(member.id) || [];
        return records.length === 0 || records.every((record) => !record.updatedByParent);
    }).length;

    const sortedEvents = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate));
    const consentEvents = sortedEvents.filter((event) => event.consentRequired);
    const eventConsentCount = consentEvents.length;

    return {
        eventConsentCount,
        medicalAttentionCount,
        upcomingEventCount: sortedEvents.length,
        totalAttentionCount: eventConsentCount + medicalAttentionCount,
        nextEvent: sortedEvents[0] || null,
        nextConsentEvent: consentEvents[0] || null
    };
}
