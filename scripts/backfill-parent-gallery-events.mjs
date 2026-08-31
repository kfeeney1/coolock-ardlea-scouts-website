import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

const apply = process.env.APPLY === "true";
const eventFilter = (process.env.EVENT_ID ?? "").trim();
if (eventFilter.includes("/")) throw new Error("EVENT_ID must be a Firestore document ID when supplied.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const accessSnapshot = await db.collectionGroup("parents").get();
const eventIds = [...new Set(accessSnapshot.docs
  .filter((snapshot) => snapshot.ref.parent.parent?.parent?.id === "eventGalleryAccess" && snapshot.data().active === true)
  .map((snapshot) => snapshot.ref.parent.parent?.id)
  .filter((eventId) => eventId && (!eventFilter || eventId === eventFilter)))];

let eligible = 0;
let skipped = 0;
let written = 0;

for (const eventId of eventIds) {
  const eventSnapshot = await db.collection("events").doc(eventId).get();
  if (!eventSnapshot.exists) {
    skipped += 1;
    console.log(`SKIP ${eventId}: event document is missing.`);
    continue;
  }

  const event = eventSnapshot.data();
  const status = typeof event.status === "string" ? event.status.trim() : "";
  if (!["open", "closed", "completed"].includes(status)) {
    skipped += 1;
    console.log(`SKIP ${eventId}: status ${status || "<missing>"} is not parent-gallery eligible.`);
    continue;
  }

  const projection = {
    eventId,
    title: typeof event.title === "string" ? event.title.trim().slice(0, 200) : "",
    description: typeof event.description === "string" ? event.description.trim().slice(0, 3000) : "",
    eventType: typeof event.eventType === "string" ? event.eventType.trim().slice(0, 80) : "",
    section: typeof event.section === "string" ? event.section.trim().slice(0, 80) : "",
    location: typeof event.location === "string" ? event.location.trim().slice(0, 300) : "",
    startDate: typeof event.startDate === "string" ? event.startDate.trim().slice(0, 30) : "",
    endDate: typeof event.endDate === "string" ? event.endDate.trim().slice(0, 30) : "",
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!projection.title || !projection.eventType || !projection.section || !projection.startDate || !projection.endDate) {
    skipped += 1;
    console.log(`SKIP ${eventId}: required gallery-safe event metadata is incomplete.`);
    continue;
  }

  eligible += 1;
  console.log(`${apply ? "WRITE" : "WOULD WRITE"} parentGalleryEvents/${eventId} (${projection.section}, ${status}).`);
  if (apply) {
    await db.collection("parentGalleryEvents").doc(eventId).set(projection);
    written += 1;
  }
}

console.log(`Parent gallery event backfill: activeEvents=${eventIds.length}, eligible=${eligible}, skipped=${skipped}, written=${written}, mode=${apply ? "apply" : "dry-run"}.`);
if (!apply && eligible > 0) console.log("No changes were written. Review the output and set APPLY=true to materialize the retained event projections.");
