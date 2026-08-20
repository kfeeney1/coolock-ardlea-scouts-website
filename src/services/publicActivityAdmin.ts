import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { EventRecord } from "./eventAdmin";

function publicFields(event: EventRecord) {
  return {
    eventId: event.id,
    title: event.title,
    description: event.description,
    eventType: event.eventType,
    section: event.section,
    location: event.location,
    startDate: event.startDate,
    endDate: event.endDate,
    status: event.status,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid ?? ""
  };
}

export async function syncPublicActivities(events: EventRecord[]): Promise<void> {
  if (!auth.currentUser) return;

  await Promise.all(
    events.map((event) =>
      setDoc(doc(db, "publicActivities", event.id), publicFields(event), { merge: true })
    )
  );
}
