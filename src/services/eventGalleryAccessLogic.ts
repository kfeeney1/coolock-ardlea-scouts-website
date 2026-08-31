export type GalleryAccessDecision = {
    eventId: string;
    section: string;
    parentUid: string;
    memberId: string;
    consentApplicationId: string;
    active: boolean;
};

export type GalleryAccessInputs = {
    event: {
        id: string;
        section: string;
        startDate: string;
        attendance: Record<string, string>;
    };
    parent: {
        uid: string;
        status: string;
        memberIds: string[];
        linkedSections: string[];
    };
    member: {
        id: string;
        section: string;
    };
    consent: {
        id: string;
        memberId: string;
        section: string;
        formType: string;
        status: string;
        photoConsent: string;
        consentFrom: string;
        consentTo: string;
    };
};

function isIsoDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function consentCoversEvent(consentFrom: string, consentTo: string, eventDate: string): boolean {
    if (!isIsoDate(consentFrom) || !isIsoDate(consentTo) || !isIsoDate(eventDate)) return false;
    return consentFrom <= eventDate && eventDate <= consentTo;
}

export function buildGalleryAccessDecision(input: GalleryAccessInputs): GalleryAccessDecision {
    const { event, parent, member, consent } = input;
    if (!event.id || !event.section || !parent.uid || !member.id || !consent.id) {
        throw new Error("Gallery access requires event, section, parent, member and consent identifiers.");
    }
    if (parent.status !== "approved") throw new Error("Parent account must be approved.");
    if (!parent.memberIds.includes(member.id)) throw new Error("Parent is not linked to this member.");
    if (!parent.linkedSections.includes(event.section)) throw new Error("Parent is not linked to the event section.");
    if (member.section !== event.section) throw new Error("Member section does not match the event section.");
    if (event.attendance[member.id] !== "attending") throw new Error("Member must be attending the event.");
    if (consent.formType !== "youth-activity-consent" || consent.status !== "active") {
        throw new Error("An active youth activity consent is required.");
    }
    if (consent.memberId !== member.id || consent.section !== event.section) {
        throw new Error("Consent does not belong to this member and section.");
    }
    if (consent.photoConsent !== "Yes") throw new Error("Photo sharing consent has not been granted.");
    if (!consentCoversEvent(consent.consentFrom, consent.consentTo, event.startDate)) {
        throw new Error("Photo consent does not cover the event date.");
    }

    return {
        eventId: event.id,
        section: event.section,
        parentUid: parent.uid,
        memberId: member.id,
        consentApplicationId: consent.id,
        active: true
    };
}

export function galleryAccessDocumentPath(eventId: string, parentUid: string): string {
    const clean = (value: string) => value.trim();
    if (!clean(eventId) || clean(eventId).includes("/") || !clean(parentUid) || clean(parentUid).includes("/")) {
        throw new Error("Gallery access identifiers must be non-empty Firestore document IDs.");
    }
    return `eventGalleryAccess/${clean(eventId)}/parents/${clean(parentUid)}`;
}
