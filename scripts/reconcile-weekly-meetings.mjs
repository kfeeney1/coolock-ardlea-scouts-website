import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
const mode = process.argv.includes("--apply") ? "apply" : "check";
initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const required = ["location", "status", "plannedActivities", "plannedBadgework", "medicalIssues"];
const allowedStatuses = new Set(["planned", "open", "closed"]);
const snapshot = await db.collection("weeklyMeetings").get();
const incompatible = [];
let migrated = 0;

for (const item of snapshot.docs) {
  const data = item.data();
  const patch = {};
  if (typeof data.section !== "string" || !data.section.trim() || typeof data.meetingDate !== "string" || !data.meetingDate.trim() || !Array.isArray(data.entries) || typeof data.notes !== "string") {
    incompatible.push(`${item.id}: missing legacy core fields`);
    continue;
  }
  if (typeof data.location !== "string" || !data.location.trim()) patch.location = "Scout Den";
  if (!allowedStatuses.has(data.status)) patch.status = "closed";
  if (!Array.isArray(data.plannedActivities)) patch.plannedActivities = [];
  if (!Array.isArray(data.plannedBadgework)) patch.plannedBadgework = [];
  if (!Array.isArray(data.medicalIssues)) patch.medicalIssues = [];

  if (Object.keys(patch).length > 0) {
    if (mode === "apply") {
      await item.ref.update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
      migrated += 1;
    } else {
      incompatible.push(`${item.id}: missing ${required.filter((key) => key in patch).join(", ")}`);
    }
  }
}

if (incompatible.length > 0) {
  console.error("Weekly meeting compatibility check failed:");
  for (const problem of incompatible) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(mode === "apply" ? `Weekly meeting reconciliation complete (${migrated} migrated).` : `All ${snapshot.size} weekly meeting records use the canonical lifecycle schema.`);
}
