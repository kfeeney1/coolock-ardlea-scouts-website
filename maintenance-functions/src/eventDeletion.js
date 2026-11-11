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
  const revision = snapshot.updateTime?.toMillis?.();
  if (!Number.isSafeInteger(revision) || revision <= 0) {
    throw new HttpsError("failed-precondition", "Event revision unavailable; deletion review cannot be trusted.");
  }
  const linked = {};
  for (const child of ["audienceMembers", "programmeAccess", "programmes", "leaderAttendance"]) {
    const collection = await eventRef.collection(child).limit(1).get();
    linked[child] = !collection.empty;
  }
  if (typeof event.section !== "string" || !event.section.trim() || event.section.includes("/")) throw new HttpsError("failed-precondition", "Invalid event section.");
  const [photos] = await bucket.getFiles({ prefix: `attachments/event-gallery/${event.section}/${eventId}/`, maxResults: 1 });
  const [publicProjection, parentProjection] = await Promise.all([db.doc("publicEvents/" + eventId).get(), db.doc("parentGalleryEvents/" + eventId).get()]);
  const blockers = Object.entries(linked).filter(([, present]) => present).map(([name]) => name);
  if (photos.length) blockers.push("gallery photos (at least one)");
  if (event.hallResource || event.hallInterval || event.hallRevision) blockers.push("hall booking association");
  if (event.audience?.resolvedMemberIds?.length || event.audience?.memberIds?.length) blockers.push("member audience evidence");
  if (publicProjection.exists) blockers.push("public event projection");
  if (parentProjection.exists) blockers.push("parent gallery projection");
  if (Object.keys(event.attendance ?? {}).length || Object.keys(event.consent ?? {}).length) blockers.push("attendance/consent evidence");
  if (event.consentLinkToken) blockers.push("consent link");
  // Financial, calendar, notification and equipment records may refer to this event
  // without being nested under it. Until every such reference has a verified
  // index and preservation policy, server-side deletion MUST remain denied.
  blockers.push("cross-collection evidence verification pending");
  if (action === "inspect") {
    return { eventId, title: event.title, section: event.section, startDate: event.startDate, endDate: event.endDate, photoCount: photos.length, photoCountIsMinimum: true, revision, blockers };
  }
  throw new HttpsError("failed-precondition", "Deletion is blocked until all event references can be safely reconciled.");
}
