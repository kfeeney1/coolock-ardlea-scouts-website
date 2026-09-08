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
    // A blank end date is the canonical representation of a single-day event.
    // Only the start date is required for a public event to be renderable.
    if (!title || !eventType || !section || !startDate) return null;

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
    const [upcoming, inProgress] = await Promise.all([
        getDocs(query(collection(db, "publicEvents"), where("startDate", ">=", today), orderBy("startDate", "asc"))),
        getDocs(query(collection(db, "publicEvents"), where("endDate", ">=", today), orderBy("endDate", "asc")))
    ]);

    return [...new Map([...upcoming.docs, ...inProgress.docs].map((snapshot) => [snapshot.id, snapshot])).values()]
        .map(mapPublicEvent)
        .filter((event): event is PublicEvent => event !== null)
        .filter((event) => (event.endDate || event.startDate) >= today)
        .sort((left, right) => left.startDate.localeCompare(right.startDate));
}
