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
  // Reject forged confirmations before performing potentially expensive inventory.
  // The persisted event revision is still checked after inventory.
  if (action === "delete" && (typeof request.data?.confirmTitle !== "string"
    || !request.data.confirmTitle.trim() || !Number.isSafeInteger(request.data?.revision)
    || request.data.revision <= 0 || request.data?.confirmation !== "DELETE EVENT")) {
    throw new HttpsError("failed-precondition", "Refresh the review and confirm the exact event title and revision.");
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
  // Reject stale or mistitled confirmations before any external inventory reads.
  // The second revision read below still detects edits during the inventory.
  if (action === "delete" && (request.data.confirmTitle !== event.title || request.data.revision !== revision)) {
    throw new HttpsError("failed-precondition", "Refresh the review and confirm the exact event title and revision.");
  }
  if (typeof event.section !== "string" || event.section.trim() !== event.section
    || !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,127}$/.test(event.section)) {
    throw new HttpsError("failed-precondition", "Invalid event section.");
  }
  // Discover actual nested collections instead of assuming the known four are exhaustive.
  // Unknown nested records must not become orphaned when the event document is removed.
  const knownChildren = ["audienceMembers", "programmeAccess", "programmes", "leaderAttendance"];
  const discovered = await eventRef.listCollections();
  const discoveredNames = discovered.map(collection => collection.id);
  const childNames = [...new Set([...knownChildren, ...discoveredNames])];
  const linked = {};
  for (const child of childNames) {
    const collection = await eventRef.collection(child).limit(101).get();
    linked[child] = { count: collection.size ?? collection.docs?.length ?? (collection.empty ? 0 : 1), truncated: (collection.size ?? collection.docs?.length ?? 0) >= 101 };
  }
  // Bound the scan to avoid unbounded Storage listings. A full inventory is still
  // required before any destructive operation is ever enabled.
  // Match the client gallery path normalisation: spaces in section labels become hyphens.
  // Otherwise a section such as "All Sections" would silently miss its photos.
  const gallerySection = event.section.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const [photos] = await bucket.getFiles({ prefix: `attachments/event-gallery/${gallerySection}/${eventId}/`, maxResults: 101 });
  const [publicProjection, parentProjection] = await Promise.all([db.doc("publicEvents/" + eventId).get(), db.doc("parentGalleryEvents/" + eventId).get()]);
  // Even known collections can contain descendant documents beneath missing
  // direct parents. A zero direct-document count is not proof the subtree is empty.
  const blockers = discoveredNames.map(name => `event subcollection requires recursive inventory: ${name}`);
  blockers.push(...Object.entries(linked).filter(([, evidence]) => evidence.count > 0).map(([name, evidence]) => `${name} (${evidence.truncated ? "more than 100" : evidence.count} linked records)`));
  if (photos.length) blockers.push(`gallery photos (${photos.length >= 101 ? "more than 100" : photos.length} found)`);
  if (event.hallResource || event.hallInterval || event.hallRevision) blockers.push("hall booking association");
  if (event.audience?.resolvedMemberIds?.length || event.audience?.memberIds?.length) blockers.push("member audience evidence");
  if (publicProjection.exists) blockers.push("public event projection");
  if (parentProjection.exists) blockers.push("parent gallery projection");
  // Parent gallery grants live under an independent event-keyed root.
  // Inspect both the root and its child collections so grants cannot be orphaned.
  const galleryAccessRef = db.doc("eventGalleryAccess/" + eventId);
  const galleryAccessRoot = await galleryAccessRef.get();
  if (galleryAccessRoot.exists) blockers.push("event gallery access root");
  const galleryAccessCollections = await galleryAccessRef.listCollections();
  for (const child of galleryAccessCollections) {
    // A collection can contain deeper descendants even if its direct documents
    // are currently absent. Never silently ignore an unexpected collection.
    blockers.push(`gallery access subcollection requires recursive inventory: ${child.id}`);
    const matches = await child.limit(101).get();
    const count = matches.size ?? matches.docs?.length ?? (matches.empty ? 0 : 1);
    linked["eventGalleryAccess/" + child.id] = { count, truncated: count >= 101 };
    if (count > 0) blockers.push(`event gallery access ${child.id} (${count >= 101 ? "more than 100" : count} linked records)`);
  }
  if (event.audience && (typeof event.audience !== "object" || Array.isArray(event.audience)
    || !Array.isArray(event.audience.sectionIds) || !Array.isArray(event.audience.memberIds)
    || !Array.isArray(event.audience.resolvedMemberIds))) blockers.push("unrecognised audience structure");
  if (Array.isArray(event.audience?.sectionIds) && event.audience.sectionIds.length) blockers.push("section audience evidence");
  if (Object.keys(event.attendance ?? {}).length || Object.keys(event.consent ?? {}).length) blockers.push("attendance/consent evidence");
  if (event.consentLinkToken) blockers.push("consent link");
  // Consent links, submitted responses and canonical consent applications live outside events/{id}. Preserve
  // safeguarding evidence and block deletion whenever either exists.
  for (const collectionName of ["eventConsentLinks", "eventConsentResponses", "consentApplications"]) {
    const matches = await db.collection(collectionName).where("eventId", "==", eventId).limit(101).get();
    const count = matches.size ?? matches.docs?.length ?? (matches.empty ? 0 : 1);
    linked[collectionName] = { count, truncated: count >= 101 };
    if (count > 0) blockers.push(`${collectionName} (${count >= 101 ? "more than 100" : count} linked records)`);
  }
  // Independently stored operational evidence is retained and blocks deletion.
  for (const collectionName of ["financeTransactions", "equipmentLoans", "equipmentIncidents"]) {
    const matches = await db.collection(collectionName).where("eventId", "==", eventId).limit(101).get();
    const count = matches.size ?? matches.docs?.length ?? (matches.empty ? 0 : 1);
    linked[collectionName] = { count, truncated: count >= 101 };
    if (count > 0) blockers.push(`${collectionName} (${count >= 101 ? "more than 100" : count} linked records)`);
  }
  // Check independent calendar, invitation and notification projections. These
  // records must be reconciled before the canonical event can be removed.
  for (const collectionName of ["eventInvitations", "eventNotifications", "calendarEntries"]) {
    const matches = await db.collection(collectionName).where("eventId", "==", eventId).limit(101).get();
    const count = matches.size ?? matches.docs?.length ?? (matches.empty ? 0 : 1);
    linked[collectionName] = { count, truncated: count >= 101 };
    if (count > 0) blockers.push(`${collectionName} (${count >= 101 ? "more than 100" : count} linked records)`);
  }
  // A concurrent event edit invalidates the review
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
