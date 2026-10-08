import { collection, getDocs, query, where } from "firebase/firestore";

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

export async function loadParentEventConsentLinks(memberIds: string[]): Promise<ParentEventConsentLink[]> {
    const linkedMemberIds = [...new Set(memberIds.filter(Boolean))].slice(0, 8);
    if (linkedMemberIds.length === 0) return [];

    // Restrict the query to the parent's approved linked children. Firestore Rules
    // also verify the event audience membership, so editing query state cannot
    // reveal a selected-member event to an unrelated parent.
    const snapshot = await getDocs(
        query(
            collection(db, "eventConsentLinks"),
            where("active", "==", true),
            where("audienceMemberIds", "array-contains-any", linkedMemberIds)
        )
    );
    const linkedMemberIdSet = new Set(linkedMemberIds);

    return snapshot.docs
        .map((item) => {
            const data = item.data() as Record<string, unknown>;
            return {
                token: item.id,
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
                audienceMemberIds: Array.isArray(data.audienceMemberIds) ? data.audienceMemberIds.filter((id): id is string => typeof id === "string") : []
            };
        })
        .filter((event) => event.audienceMemberIds.some((id) => linkedMemberIdSet.has(id)))
        .filter((event) => event.title && event.startDate)
        .filter((event) => event.startDate >= new Date().toISOString().slice(0, 10))
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
