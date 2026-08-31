export type GalleryAccessProjection = {
    parentUid: string;
    eventId: string;
    section: string;
    memberIds: string[];
    active: boolean;
    consentSource: "youth-activity-consent";
    consentApplicationIds: string[];
    updatedAt?: unknown;
};

export type GalleryConsentCandidate = {
    id: string;
    memberId?: string;
    status?: string;
    formType?: string;
    photoConsent?: boolean;
    consentFrom?: string;
    consentTo?: string;
};

export function galleryAccessProjectionPath(parentUid: string, eventId: string) {
    return `galleryAccess/${parentUid}/events/${eventId}`;
}

export function hasCurrentPhotoConsent(candidate: GalleryConsentCandidate, eventDate: string) {
    if (candidate.status !== "active" || candidate.formType !== "youth-activity-consent" || candidate.photoConsent !== true) return false;
    if (candidate.consentFrom && eventDate < candidate.consentFrom) return false;
    if (candidate.consentTo && eventDate > candidate.consentTo) return false;
    return Boolean(candidate.memberId);
}

export function buildGalleryAccessProjection(input: {
    parentUid: string;
    eventId: string;
    section: string;
    eventDate: string;
    linkedMemberIds: string[];
    attendingMemberIds: string[];
    consentApplications: GalleryConsentCandidate[];
}): GalleryAccessProjection {
    const eligible = input.consentApplications.filter((candidate) =>
        candidate.memberId
        && input.linkedMemberIds.includes(candidate.memberId)
        && input.attendingMemberIds.includes(candidate.memberId)
        && hasCurrentPhotoConsent(candidate, input.eventDate));

    return {
        parentUid: input.parentUid,
        eventId: input.eventId,
        section: input.section,
        memberIds: [...new Set(eligible.map((candidate) => candidate.memberId!))].sort(),
        active: eligible.length > 0,
        consentSource: "youth-activity-consent",
        consentApplicationIds: eligible.map((candidate) => candidate.id).sort(),
    };
}
