import type { ParentConsentRecord, ParentLinkedMember } from "./parentConsent";
import type { ParentEventConsentLink } from "./parentEvents";

export type ParentTaskSummary = {
    eventConsentCount: number;
    medicalAttentionCount: number;
    upcomingEventCount: number;
    totalAttentionCount: number;
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

    const eventConsentCount = events.filter((event) => event.consentRequired).length;

    return {
        eventConsentCount,
        medicalAttentionCount,
        upcomingEventCount: events.length,
        totalAttentionCount: eventConsentCount + medicalAttentionCount
    };
}
