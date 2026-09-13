import type { ParentConsentRecord, ParentLinkedMember } from "./parentConsent";
import type { ParentEventConsentLink } from "./parentEvents";
import { evaluateMemberFormLifecycle, type FormRenewalConsent } from "./formRenewalLogic";

export type ParentTaskSummary = {
    eventConsentCount: number;
    medicalAttentionCount: number;
    upcomingEventCount: number;
    totalAttentionCount: number;
    nextEvent: ParentEventConsentLink | null;
    nextConsentEvent: ParentEventConsentLink | null;
};

function lifecycleConsent(record: ParentConsentRecord): FormRenewalConsent {
    return {
        memberId: record.memberId,
        formType: "youth-activity-consent",
        status: "active",
        consentTo: record.consentTo,
        // Parent consent records currently expose the explicit parent renewal
        // timestamp. Generic updatedAt must never be used to extend validity.
        submittedAt: null,
        updatedAt: record.updatedAt,
        parentUpdatedAt: record.parentUpdatedAt
    };
}

export function summariseParentTasks(
    events: ParentEventConsentLink[],
    members: ParentLinkedMember[],
    consents: ParentConsentRecord[],
    asOf: Date = new Date()
): ParentTaskSummary {
    const lifecycleConsents = consents.map(lifecycleConsent);
    const medicalAttentionCount = members.filter((member) => {
        const lifecycle = evaluateMemberFormLifecycle(
            { id: member.id, active: true },
            lifecycleConsents,
            asOf
        );
        return lifecycle !== null && lifecycle.status !== "current";
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
