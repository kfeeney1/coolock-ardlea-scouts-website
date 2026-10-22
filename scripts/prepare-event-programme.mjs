import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { requireFirebaseMutationTarget } from "./firebase-operation-guard.mjs";
// One explicit source record per invocation. Dry-run first; no scans or participant output.
const eventId = process.env.EVENT_ID || "";
if (!eventId || eventId.includes("/")) throw new Error("Set EVENT_ID to one canonical event ID.");
const apply = process.env.APPLY === "true", credentialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
requireFirebaseMutationTarget({operation: "prepare-event-programme", credentialJson, allowProduction: true});
initializeApp({credential: credentialJson ? cert(JSON.parse(credentialJson)) : applicationDefault()});
const db = getFirestore(), eventRef = db.doc(`events/${eventId}`);
await db.runTransaction(async transaction => {
  const event = await transaction.get(eventRef);
  if (!event.exists) throw new Error("Source event does not exist.");
  const data = event.data();
  const keys = ["title", "description", "eventType", "section", "location", "startDate", "endDate", "status"];
  if (keys.some(key => typeof data[key] !== "string")) throw new Error("Source event has incomplete programme fields; repair through Events first.");
  const memberships = await transaction.get(eventRef.collection("audienceMembers"));
  if (memberships.size > 450) throw new Error("Audience exceeds the canonical cap; investigate before preparing.");
  if (data.audience?.mode && ["members", "mixed"].includes(data.audience.mode) && memberships.empty) throw new Error("Private source has no canonical audience relationships. Confirm and migrate its audience through Events before preparation.");
  if (apply) {
    transaction.set(eventRef.collection("programmes").doc("parent"), {eventId, ...Object.fromEntries(keys.map(key => [key, data[key]]))});
    memberships.docs.forEach(member => transaction.update(member.ref, {startDate: data.startDate, endDate: data.endDate, programmeVisible: data.status !== "draft"}));
  }
  console.log(`${apply ? "Prepared" : "Would prepare"} source event ${eventId}; no participant data logged.`);
});
