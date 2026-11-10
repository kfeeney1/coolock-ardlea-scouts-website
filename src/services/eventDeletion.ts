import { collection, doc, getDoc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { listAll, ref } from "firebase/storage";
import { auth, db, storage } from "../firebase";
import { UserFacingError } from "./applicationErrors.ts";
import type { EventRecord } from "./eventAdmin";

export type EventDeletionPreflight = { event: EventRecord; photoCount: number; blockers: string[] };

const EVENT_CHILD_COLLECTIONS = ["audienceMembers", "programmeAccess", "programmes", "leaderAttendance"] as const;

/**
 * Fail-closed cleanup: until the event's linked consent, financial, and notification
 * lifecycle has a trusted server-side cascade, only dependency-free records qualify.
 * Do not delete event documents with children: Firestore does not cascade subcollections.
 */
export async function inspectEventDeletion(event: EventRecord): Promise<EventDeletionPreflight> {
  const user = auth.currentUser;
  if (!user) throw new UserFacingError("Sign in as Super Admin.");
  const profile = await getDoc(doc(db, "adminUsers", user.uid));
  if (!profile.exists() || profile.data().active !== true || profile.data().role !== "super-admin"
    || !Array.isArray(profile.data().sections) || profile.data().sections.length === 0
    || Object.hasOwn(profile.data(), "section")) {
    throw new UserFacingError("Only an active Super Admin can delete events.");
  }
  const current = await getDoc(doc(db, "events", event.id));
  if (!current.exists()) throw new UserFacingError("This event no longer exists.");
  const data = current.data();
  if (data.title !== event.title || data.startDate !== event.startDate || data.endDate !== event.endDate || data.section !== event.section) {
    throw new UserFacingError("Event details have changed. Refresh before attempting deletion.");
  }

  const blockers: string[] = [];
  for (const name of EVENT_CHILD_COLLECTIONS) {
    const snapshot = await getDocs(collection(db, "events", event.id, name));
    if (!snapshot.empty) blockers.push(`${snapshot.size} ${name} record(s)`);
  }
  if (Object.keys(data.attendance ?? {}).length || Object.keys(data.consent ?? {}).length) {
    blockers.push("attendance or consent history");
  }
  // Storage listing failures are intentionally fatal; a missing/disabled bucket
  // must never be mistaken for an empty gallery.
  const gallery = await listAll(ref(storage, `attachments/event-gallery/${event.section}/${event.id}`));
  const nested = await Promise.all(gallery.prefixes.map((prefix) => listAll(prefix)));
  const photoCount = gallery.items.length + nested.reduce((count, group) => count + group.items.length + group.prefixes.length, 0);
  if (photoCount) blockers.push(`${photoCount} gallery photo(s) or nested folders`);
  if (event.consentLinkToken) blockers.push("consent-link token");
  // Linked financial, equipment, calendar, notification and consent documents can
  // live outside the event tree. No client-only scan can prove their absence.
  blockers.push("external financial, consent, equipment and notification references require trusted cleanup verification");
  return { event, photoCount, blockers };
}

/** Kept disabled until a trusted service can verify all cross-collection references. */
export async function deleteInspectedEvent(_preflight: EventDeletionPreflight): Promise<never> {
  throw new UserFacingError("Deletion is not yet enabled: linked evidence must be checked by a trusted cleanup service.");
}

// Reserved for the trusted-service implementation: the event and projections must
// be removed atomically with a durable audit record, not via separate client deletes.
export function eventDeletionDocumentPaths(eventId: string) {
  return [`events/${eventId}`, `publicEvents/${eventId}`, `parentGalleryEvents/${eventId}`];
}
