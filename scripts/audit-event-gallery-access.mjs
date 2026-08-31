import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

const apply = process.env.APPLY === "true";
const eventFilter = (process.env.EVENT_ID ?? "").trim();
const sectionFilter = (process.env.SECTION ?? "").trim();
if (eventFilter.includes("/")) throw new Error("EVENT_ID must be a Firestore document ID when supplied.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

function stringValue(data, key) {
  return typeof data?.[key] === "string" ? data[key].trim() : "";
}

async function projectionIssues(snapshot) {
  const projection = snapshot.data();
  const eventId = stringValue(projection, "eventId");
  const parentUid = stringValue(projection, "parentUid");
  const memberId = stringValue(projection, "memberId");
  const section = stringValue(projection, "section");
  const consentApplicationId = stringValue(projection, "consentApplicationId");
  const issues = [];

  if (!eventId || snapshot.ref.parent.parent?.id !== eventId) issues.push("event-id-mismatch");
  if (!parentUid || snapshot.id !== parentUid) issues.push("parent-id-mismatch");
  if (!memberId) issues.push("missing-member-id");
  if (!section) issues.push("missing-section");
  if (!consentApplicationId) issues.push("missing-consent-id");
  if (projection.active !== true) issues.push("inactive");

  if (!eventId || !parentUid || !memberId || !section || !consentApplicationId) return issues;

  const [eventSnapshot, parentSnapshot, memberSnapshot, consentSnapshot] = await Promise.all([
    db.collection("events").doc(eventId).get(),
    db.collection("parentAccounts").doc(parentUid).get(),
    db.collection("members").doc(memberId).get(),
    db.collection("consentApplications").doc(consentApplicationId).get(),
  ]);

  if (!eventSnapshot.exists) issues.push("event-missing");
  if (!parentSnapshot.exists) issues.push("parent-missing");
  if (!memberSnapshot.exists) issues.push("member-missing");
  if (!consentSnapshot.exists) issues.push("consent-missing");
  if (!eventSnapshot.exists || !parentSnapshot.exists || !memberSnapshot.exists || !consentSnapshot.exists) return issues;

  const event = eventSnapshot.data();
  const parent = parentSnapshot.data();
  const member = memberSnapshot.data();
  const consent = consentSnapshot.data();
  const eventDate = stringValue(event, "startDate");

  if (stringValue(event, "section") !== section) issues.push("event-section-mismatch");
  if (event?.attendance?.[memberId] !== "attending") issues.push("member-not-attending");
  if (parent.status !== "approved") issues.push("parent-not-approved");
  if (!Array.isArray(parent.memberIds) || !parent.memberIds.includes(memberId)) issues.push("parent-member-unlinked");
  if (!Array.isArray(parent.linkedSections) || !parent.linkedSections.includes(section)) issues.push("parent-section-unlinked");
  if (stringValue(member, "section") !== section) issues.push("member-section-mismatch");
  if (consent.formType !== "youth-activity-consent" || consent.status !== "active" || consent.photoConsent !== "Yes") issues.push("photo-consent-ineligible");
  if (stringValue(consent, "memberId") !== memberId || stringValue(consent, "section") !== section) issues.push("consent-link-mismatch");

  const from = stringValue(consent, "consentFrom");
  const to = stringValue(consent, "consentTo");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || eventDate < from || eventDate > to) {
    issues.push("consent-date-outside-event");
  }

  return issues;
}

const snapshots = await db.collectionGroup("parents").get();
const projections = snapshots.docs.filter((snapshot) => snapshot.ref.parent.parent?.parent?.id === "eventGalleryAccess");
let scanned = 0;
let healthy = 0;
let stale = 0;
let deactivated = 0;

for (const snapshot of projections) {
  const data = snapshot.data();
  const eventId = stringValue(data, "eventId") || snapshot.ref.parent.parent?.id || "";
  const section = stringValue(data, "section");
  if (eventFilter && eventId !== eventFilter) continue;
  if (sectionFilter && section !== sectionFilter) continue;
  scanned += 1;

  const issues = await projectionIssues(snapshot);
  const actionable = issues.filter((issue) => issue !== "inactive");
  if (actionable.length === 0) {
    healthy += 1;
    console.log(`OK ${snapshot.ref.path}${issues.includes("inactive") ? " (already inactive)" : ""}`);
    continue;
  }

  stale += 1;
  console.log(`STALE ${snapshot.ref.path}: ${actionable.join(", ")}`);
  if (apply && data.active === true) {
    await snapshot.ref.set({ active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    deactivated += 1;
    console.log(`  deactivated ${snapshot.ref.path}`);
  }
}

console.log(`Gallery access audit: scanned=${scanned}, healthy=${healthy}, stale=${stale}, deactivated=${deactivated}, mode=${apply ? "apply" : "dry-run"}.`);
if (!apply && stale > 0) console.log("No changes were written. Review the reasons above and set APPLY=true only when the stale projections should be deactivated.");
