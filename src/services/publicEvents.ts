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

function mapPublicEvent(snapshot: QueryDocumentSnapshot<DocumentData>): PublicEvent | null {
    const data = snapshot.data();
    const title = stringValue(data, "title");
    const eventType = stringValue(data, "eventType");
    const section = stringValue(data, "section");
    const startDate = stringValue(data, "startDate");
    const endDate = stringValue(data, "endDate");
    if (!title || !eventType || !section || !startDate || !endDate) return null;

    return {
        id: snapshot.id,
        title,
        description: stringValue(data, "description"),
        eventType,
        section,
        location: stringValue(data, "location"),
        startDate,
        endDate
    };
}

export async function loadUpcomingPublicEvents(): Promise<PublicEvent[]> {
    const today = new Date().toISOString().slice(0, 10);
    const snapshot = await getDocs(
        query(collection(db, "publicEvents"), where("startDate", ">=", today), orderBy("startDate", "asc"))
    );

    return snapshot.docs
        .map(mapPublicEvent)
        .filter((event): event is PublicEvent => event !== null);
}
