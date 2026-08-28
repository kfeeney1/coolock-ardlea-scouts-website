import type { AttendanceStatus, EventConsentStatus, EventRecord } from "./eventAdmin.ts";
import type { MemberRecord } from "./memberAdmin.ts";
import type { EventConsentResponse } from "./eventConsent.ts";

export function normaliseConsentMatchValue(value: string): string {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function eligibleEventMembers(event: EventRecord, members: MemberRecord[]): MemberRecord[] {
    return members.filter(
        (member) =>
            member.status === "active" &&
            (event.section === "All Sections" || member.section === event.section)
    );
}

export function findMatchingMember(
    response: EventConsentResponse,
    members: MemberRecord[],
    usedMembers?: Set<string>
): MemberRecord | undefined {
    return members.find(
        (candidate) =>
            !usedMembers?.has(candidate.id) &&
            normaliseConsentMatchValue(candidate.displayName) === normaliseConsentMatchValue(response.childName) &&
            (!candidate.dateOfBirth || candidate.dateOfBirth === response.dateOfBirth)
    );
}

export function applyResponseToRoster(
    response: EventConsentResponse,
    memberId: string,
    attendance: Record<string, AttendanceStatus>,
    consent: Record<string, EventConsentStatus>
): void {
    attendance[memberId] = response.attendance;
    if (response.attendance === "not-attending") {
        consent[memberId] = "not-required";
    } else if (response.consentGiven) {
        consent[memberId] = "received";
    } else {
        consent[memberId] = "required";
    }
}

export function outstandingConsentMembers(event: EventRecord, members: MemberRecord[]): MemberRecord[] {
    return eligibleEventMembers(event, members).filter(
        (member) =>
            event.consent[member.id] !== "received" &&
            event.attendance[member.id] !== "not-attending"
    );
}

export function eventConsentSummary(event: EventRecord, members: MemberRecord[], responses: EventConsentResponse[]) {
    const eligibleMembers = eligibleEventMembers(event, members);
    const newResponses = responses.filter((response) => response.processingStatus === "new");
    return {
        eligibleMembers,
        newResponses,
        matchedResponses: responses.filter((response) => response.processingStatus === "matched"),
        ignoredResponses: responses.filter((response) => response.processingStatus === "ignored"),
        unmatchedResponses: newResponses.filter((response) => !findMatchingMember(response, eligibleMembers)),
        received: eligibleMembers.filter((member) => event.consent[member.id] === "received").length,
        outstanding: outstandingConsentMembers(event, members).length,
        changedDetails: responses.filter((response) => response.medicalDetailsChanged).length
    };
}
