import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
const apply = process.env.APPLY === "true";
initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const ACTIVITY_MARKER = "weekly-activities-v1";
const BADGEWORK_MARKER = "weekly-badgework-v1";
const PROGRAMME_MARKER = "weekly-programme-v1";

function clean(value, max) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function cleanDuration(value) { return Number.isFinite(value) ? Math.max(0, Math.min(360, Math.round(value))) : 0; }
function durationFromTimes(start, finish) {
  if (typeof start !== "string" || typeof finish !== "string") return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [fh, fm] = finish.split(":").map(Number);
  if ([sh, sm, fh, fm].some((value) => !Number.isFinite(value))) return 0;
  const duration = (fh * 60 + fm) - (sh * 60 + sm);
  return duration > 0 && duration <= 360 ? duration : 0;
}
function decodeItems(value, marker, nameField) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (parsed?.marker !== marker || !Array.isArray(parsed.items)) return [];
    return parsed.items.map((item) => ({
      name: clean(item?.[nameField], 240),
      durationMinutes: typeof item?.durationMinutes === "number" ? cleanDuration(item.durationMinutes) : durationFromTimes(item?.startTime, item?.finishTime)
    })).filter((item) => item.name).slice(0, 30);
  } catch {
    return [];
  }
}
function decodeTheme(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const parsed = JSON.parse(value);
    return parsed?.marker === PROGRAMME_MARKER ? clean(parsed.theme, 240) : "";
  } catch {
    return "";
  }
}

const snapshot = await db.collection("weeklyMeetings").get();
console.log(`${apply ? "Applying" : "Dry-run:"} parent-safe projection rebuild for ${snapshot.size} weekly meeting(s).`);
let batch = db.batch();
let pending = 0;
let written = 0;
for (const document of snapshot.docs) {
  const data = document.data();
  const projection = {
    section: clean(data.section, 80),
    meetingDate: clean(data.meetingDate, 20),
    status: data.status === "closed" ? "closed" : "open",
    location: clean(data.location, 240),
    theme: decodeTheme(data.programmeNotes),
    activities: decodeItems(data.plannedActivities, ACTIVITY_MARKER, "activity"),
    badgework: decodeItems(data.plannedBadgework, BADGEWORK_MARKER, "badge"),
    updatedAt: FieldValue.serverTimestamp()
  };
  if (!projection.section || !projection.meetingDate) {
    console.warn(`Skipping weeklyMeetings/${document.id}: missing section or meetingDate.`);
    continue;
  }
  console.log(`- ${document.id}: ${projection.section} ${projection.meetingDate}, ${projection.activities.length} activities, ${projection.badgework.length} badgework`);
  if (!apply) continue;
  batch.set(db.collection("parentWeeklyMeetings").doc(document.id), projection);
  pending += 1;
  written += 1;
  if (pending >= 400) {
    await batch.commit();
    batch = db.batch();
    pending = 0;
  }
}
if (apply && pending) await batch.commit();
console.log(apply ? `Parent-safe weekly projections rebuilt: ${written}.` : "Dry-run complete. Set APPLY=true to write projections.");
