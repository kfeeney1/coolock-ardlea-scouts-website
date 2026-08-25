import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const SECTIONS = new Set(["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]);
const STATUSES = new Set(["open", "closed"]);
const errors = [];

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function timestampLike(value) {
  return Boolean(value) && typeof value === "object" && typeof value.toDate === "function";
}

function fail(id, message) {
  errors.push(`weeklyMeetings/${id}: ${message}`);
}

const snapshot = await db.collection("weeklyMeetings").get();
for (const document of snapshot.docs) {
  const data = document.data();

  if (!SECTIONS.has(text(data.section))) fail(document.id, `unsupported section ${JSON.stringify(data.section)}`);
  if (!text(data.meetingDate)) fail(document.id, "meetingDate must be a non-empty string");
  if (!STATUSES.has(data.status)) fail(document.id, `unsupported status ${JSON.stringify(data.status)}`);

  for (const field of ["location", "plannedActivities", "plannedBadgework", "programmeNotes", "notes"]) {
    if (typeof data[field] !== "string") fail(document.id, `${field} must be a string`);
  }

  if (!Array.isArray(data.entries)) fail(document.id, "entries must be an array");
  if (!Array.isArray(data.injuries)) fail(document.id, "injuries must be an array");
  if (!text(data.createdBy)) fail(document.id, "createdBy must be a non-empty string");
  if (!text(data.updatedBy)) fail(document.id, "updatedBy must be a non-empty string");

  if (data.createdAt !== undefined && !timestampLike(data.createdAt)) fail(document.id, "createdAt must be a Firestore timestamp when present");
  if (data.updatedAt !== undefined && !timestampLike(data.updatedAt)) fail(document.id, "updatedAt must be a Firestore timestamp when present");

  if (Array.isArray(data.entries)) {
    for (const [index, entry] of data.entries.entries()) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        fail(document.id, `entries[${index}] must be an object`);
        continue;
      }
      if (typeof entry.memberId !== "string") fail(document.id, `entries[${index}].memberId must be a string`);
      if (entry.present !== undefined && typeof entry.present !== "boolean") fail(document.id, `entries[${index}].present must be boolean when present`);
    }
  }

  if (Array.isArray(data.injuries)) {
    for (const [index, injury] of data.injuries.entries()) {
      if (!injury || typeof injury !== "object" || Array.isArray(injury)) fail(document.id, `injuries[${index}] must be an object`);
    }
  }
}

console.log(`Weekly meeting compatibility audit checked ${snapshot.size} live record(s).`);
if (errors.length) {
  console.error(`Weekly meeting compatibility audit failed with ${errors.length} issue(s):`);
  for (const error of errors.sort()) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Live weeklyMeetings data matches the current lifecycle field contract.");
