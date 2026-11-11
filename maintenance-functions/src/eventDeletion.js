import { HttpsError } from "firebase-functions/v2/https";

export function isCanonicalSuperAdmin(profile) {
  return profile?.active === true && profile.role === "super-admin"
    && Array.isArray(profile.sections) && profile.sections.length > 0
    && !Object.prototype.hasOwnProperty.call(profile, "section");
}

export async function handleEventDeletion(db, bucket, request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in as Super Admin.");
  const profile = (await db.doc(`adminUsers/${request.auth.uid}`).get()).data();
  if (!isCanonicalSuperAdmin(profile)) throw new HttpsError("permission-denied", "Super Admin access required.");

  const { action, eventId } = request.data ?? {};
  if (!["inspect", "delete"].includes(action) || typeof eventId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(eventId)) {
    throw new HttpsError("invalid-argument", "Invalid event deletion request.");
  }
  const eventRef = db.doc(`events/${eventId}`);
  const snapshot = await eventRef.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Event no longer exists.");
  const event = snapshot.data();
  // A deletion review must never present an incomplete or misleading title.
  // Validate persisted data before inspecting linked resources or returning it.
  if (!event || typeof event.title !== "string" || !event.title.trim()) {
    throw new HttpsError("failed-precondition", "Event title is missing; deletion review cannot be trusted.");
  }
  const revision = snapshot.updateTime?.toMillis?.();
  if (!Number.isSafeInteger(revision) || revision <= 0) {
    throw new HttpsError("failed-precondition", "Event revision unavailable; deletion review cannot be trusted.");
  }
  const linked = {};
  for (const child of ["audienceMembers", "programmeAccess", "programmes", "leaderAttendance"]) {
    const collection = await eventRef.collection(child).limit(101).get();
    linked[child] = { count: collection.size ?? collection.docs?.length ?? (collection.empty ? 0 : 1), truncated: (collection.size ?? collection.docs?.length ?? 0) >= 101 };
  }
  if (typeof event.section !== "string" || !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,127}$/.test(event.section)) throw new HttpsError("failed-precondition", "Invalid event section.");
  // Bound the scan to avoid unbounded Storage listings. A full inventory is still
  // required before any destructive operation is ever enabled.
  const [photos] = await bucket.getFiles({ prefix: `attachments/event-gallery/${event.section}/${eventId}/`, maxResults: 101 });
  const [publicProjection, parentProjection] = await Promise.all([db.doc("publicEvents/" + eventId).get(), db.doc("parentGalleryEvents/" + eventId).get()]);
  const blockers = Object.entries(linked).filter(([, evidence]) => evidence.count > 0).map(([name, evidence]) => `${name} (${evidence.truncated ? "more than 100" : evidence.count} linked records)`);
  if (photos.length) blockers.push(`gallery photos (${photos.length >= 101 ? "more than 100" : photos.length} found)`);
  if (event.hallResource || event.hallInterval || event.hallRevision) blockers.push("hall booking association");
  if (event.audience?.resolvedMemberIds?.length || event.audience?.memberIds?.length) blockers.push("member audience evidence");
  if (publicProjection.exists) blockers.push("public event projection");
  if (parentProjection.exists) blockers.push("parent gallery projection");
  if (Object.keys(event.attendance ?? {}).length || Object.keys(event.consent ?? {}).length) blockers.push("attendance/consent evidence");
  if (event.consentLinkToken) blockers.push("consent link");
  // A concurrent event edit invalidates the review even when the first read
  // succeeded. Do not return an apparently current deletion confirmation.
  const latest = await eventRef.get();
  if (!latest.exists || latest.updateTime?.toMillis?.() !== revision) {
    throw new HttpsError("failed-precondition", "Event changed during deletion review. Refresh and inspect again.");
  }
  // Financial, calendar, notification and equipment records may refer to this event
  // without being nested under it. Until every such reference has a verified
  // index and preservation policy, server-side deletion MUST remain denied.
  blockers.push("cross-collection evidence verification pending");
  if (action === "inspect") {
    return { eventId, title: event.title, section: event.section, startDate: event.startDate, endDate: event.endDate, photoCount: Math.min(photos.length, 100), photoCountIsMinimum: photos.length > 100, linked, revision, blockers };
  }
  // The eventual write path must require a fresh, exact, deliberate confirmation.
  // This validation does not grant deletion: all requests still fail closed below.
  if (request.data?.confirmTitle !== event.title || request.data?.revision !== revision
    || request.data?.confirmation !== "DELETE EVENT") {
    throw new HttpsError("failed-precondition", "Refresh the review and confirm the exact event title and revision.");
  }
  throw new HttpsError("failed-precondition", "Deletion is blocked until all event references can be safely reconciled.");
}
