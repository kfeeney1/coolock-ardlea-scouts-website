import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

const eventId = (process.env.EVENT_ID ?? "").trim();
const parentUid = (process.env.PARENT_UID ?? "").trim();
const memberId = (process.env.MEMBER_ID ?? "").trim();
const apply = process.env.APPLY === "true";
const revoke = process.env.REVOKE === "true";

for (const [name, value] of [["EVENT_ID", eventId], ["PARENT_UID", parentUid]]) {
  if (!value || value.includes("/")) throw new Error(`${name} must be a non-empty Firestore document ID.`);
}
if (!revoke && (!memberId || memberId.includes("/"))) throw new Error("MEMBER_ID is required when granting access.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const accessRef = db.collection("eventGalleryAccess").doc(eventId).collection("parents").doc(parentUid);

if (revoke) {
  const current = await accessRef.get();
  if (!current.exists) {
    console.log(`No gallery access projection exists for ${parentUid} / ${eventId}.`);
    process.exit(0);
  }
  console.log(`${apply ? "Revoking" : "Would revoke"} gallery access for ${parentUid} / ${eventId}.`);
  if (apply) await accessRef.set({ active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  else console.log("Dry-run complete. Set APPLY=true to write the revocation.");
  process.exit(0);
}

const [eventSnapshot, parentSnapshot, memberSnapshot, consentSnapshot] = await Promise.all([
  db.collection("events").doc(eventId).get(),
  db.collection("parentAccounts").doc(parentUid).get(),
  db.collection("members").doc(memberId).get(),
  db.collection("consentApplications").where("memberId", "==", memberId).get(),
]);

if (!eventSnapshot.exists) throw new Error(`events/${eventId} does not exist.`);
if (!parentSnapshot.exists) throw new Error(`parentAccounts/${parentUid} does not exist.`);
if (!memberSnapshot.exists) throw new Error(`members/${memberId} does not exist.`);

const event = eventSnapshot.data();
const parent = parentSnapshot.data();
const member = memberSnapshot.data();
const section = typeof event.section === "string" ? event.section.trim() : "";
const eventDate = typeof event.startDate === "string" ? event.startDate.trim() : "";
const eventStatus = typeof event.status === "string" ? event.status.trim() : "";
if (!section || !eventDate) throw new Error("Event is missing section or startDate.");
if (!["open", "closed", "completed"].includes(eventStatus)) throw new Error("Gallery access can be granted only for Open, Closed or Completed events.");
if (parent.status !== "approved" || !Array.isArray(parent.memberIds) || !parent.memberIds.includes(memberId)) {
  throw new Error("Parent is not approved and linked to this member.");
}
if (!Array.isArray(parent.linkedSections) || !parent.linkedSections.includes(section)) {
  throw new Error("Parent is not linked to the event section.");
}
if (member.section !== section) throw new Error("Member section does not match the event section.");
if (!event.attendance || event.attendance[memberId] !== "attending") throw new Error("Member must be attending the event.");

const eligibleConsents = consentSnapshot.docs.filter((document) => {
  const consent = document.data();
  if (consent.formType !== "youth-activity-consent" || consent.status !== "active" || consent.photoConsent !== "Yes") return false;
  if (consent.memberId !== memberId || consent.section !== section) return false;
  const from = typeof consent.consentFrom === "string" ? consent.consentFrom : "";
  const to = typeof consent.consentTo === "string" ? consent.consentTo : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= eventDate && eventDate <= to;
});
if (eligibleConsents.length === 0) throw new Error("No active photo consent covers this member and event date.");

eligibleConsents.sort((a, b) => {
  const aUpdated = a.data().parentUpdatedAt?.toMillis?.() ?? a.data().updatedAt?.toMillis?.() ?? a.data().submittedAt?.toMillis?.() ?? 0;
  const bUpdated = b.data().parentUpdatedAt?.toMillis?.() ?? b.data().updatedAt?.toMillis?.() ?? b.data().submittedAt?.toMillis?.() ?? 0;
  return bUpdated - aUpdated;
});
const consentApplicationId = eligibleConsents[0].id;
const projection = {
  eventId,
  section,
  parentUid,
  memberId,
  consentApplicationId,
  active: true,
  updatedAt: FieldValue.serverTimestamp(),
};
const parentGalleryEventProjection = {
  eventId,
  title: typeof event.title === "string" ? event.title.trim().slice(0, 200) : "",
  description: typeof event.description === "string" ? event.description.trim().slice(0, 3000) : "",
  eventType: typeof event.eventType === "string" ? event.eventType.trim().slice(0, 80) : "",
  section,
  location: typeof event.location === "string" ? event.location.trim().slice(0, 300) : "",
  startDate: eventDate,
  endDate: typeof event.endDate === "string" ? event.endDate.trim().slice(0, 30) : eventDate,
  status: eventStatus,
  updatedAt: FieldValue.serverTimestamp(),
};
if (!parentGalleryEventProjection.title || !parentGalleryEventProjection.eventType || !parentGalleryEventProjection.endDate) {
  throw new Error("Event is missing gallery-safe title, eventType or endDate metadata.");
}

console.log(`${apply ? "Granting" : "Would grant"} gallery access for parent ${parentUid}, member ${memberId}, event ${eventId}, consent ${consentApplicationId}.`);
console.log(`${apply ? "Refreshing" : "Would refresh"} retained parent gallery event metadata for ${eventId} (${eventStatus}).`);
if (apply) {
  const batch = db.batch();
  batch.set(accessRef, projection);
  batch.set(db.collection("parentGalleryEvents").doc(eventId), parentGalleryEventProjection);
  await batch.commit();
} else console.log("Dry-run complete. Set APPLY=true to write the projection.");
