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
};

function value(data: Record<string, unknown>, key: string): string {
    return typeof data[key] === "string" ? data[key] as string : "";
}

export async function loadParentEventConsentLinks(sections: string[]): Promise<ParentEventConsentLink[]> {
    const uniqueSections = [...new Set(sections.filter(Boolean))].slice(0, 10);
    if (uniqueSections.length === 0) return [];

    const snapshot = await getDocs(
        query(
            collection(db, "eventConsentLinks"),
            where("active", "==", true),
            where("section", "in", uniqueSections)
        )
    );

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
                consentRequired: data.consentRequired === true
            };
        })
        .filter((event) => event.title && event.startDate)
        .filter((event) => event.startDate >= new Date().toISOString().slice(0, 10))
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
