import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export type PublicEvent = {
    id: string;
    title: string;
    description: string;
    eventType: string;
    section: string;
    location: string;
    startDate: string;
    endDate: string;
};

function stringValue(data: DocumentData, key: string): string {
    const value = data[key];
    return typeof value === "string" ? value.trim() : "";
}

function mapPublicEvent(snapshot: QueryDocumentSnapshot<DocumentData>): PublicEvent {
    const data = snapshot.data();
    return {
        id: snapshot.id,
        title: stringValue(data, "title") || "Upcoming activity",
        description: stringValue(data, "description"),
        eventType: stringValue(data, "eventType") || "Activity",
        section: stringValue(data, "section") || "All Sections",
        location: stringValue(data, "location"),
        startDate: stringValue(data, "startDate"),
        endDate: stringValue(data, "endDate")
    };
}

export async function loadUpcomingPublicEvents(): Promise<PublicEvent[]> {
    const today = new Date().toISOString().slice(0, 10);
    const snapshot = await getDocs(
        query(
            collection(db, "publicEvents"),
            where("startDate", ">=", today),
            orderBy("startDate", "asc")
        )
    );

    return snapshot.docs.map(mapPublicEvent);
}
