import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const checkOnly = process.argv.includes("--check");
const legacyMarker = "weekly-plan-v1";
const activityMarker = "weekly-activities-v1";
const badgeworkMarker = "weekly-badgework-v1";
const programmeMarker = "weekly-programme-v1";

function legacyPlan(notes) {
  const empty = { location: "", theme: "", plannedActivities: "", plannedBadgework: "", programmeNotes: "", notes: typeof notes === "string" ? notes.trim() : "" };
  if (typeof notes !== "string" || !notes.trim()) return empty;
  try {
    const parsed = JSON.parse(notes);
    if (parsed?.marker !== legacyMarker) return empty;
    return {
      location: typeof parsed.location === "string" ? parsed.location.trim() : "",
      theme: typeof parsed.theme === "string" ? parsed.theme.trim() : "",
      plannedActivities: typeof parsed.plannedActivities === "string" ? parsed.plannedActivities.trim() : "",
      plannedBadgework: typeof parsed.plannedBadgework === "string" ? parsed.plannedBadgework.trim() : "",
      programmeNotes: typeof parsed.programmeNotes === "string" ? parsed.programmeNotes.trim() : "",
      notes: typeof parsed.postMeetingNotes === "string" ? parsed.postMeetingNotes.trim() : ""
    };
  } catch { return empty; }
}
function activityPayload(text) { const items=text?[{id:"legacy-activity-1",activity:text,leader:"",notes:"",equipment:"",startTime:"",finishTime:""}]:[]; return JSON.stringify({marker:activityMarker,items}); }
function badgeworkPayload(text) { const items=text?[{id:"legacy-badgework-1",badge:text,notes:""}]:[]; return JSON.stringify({marker:badgeworkMarker,items}); }
function programmePayload(theme, notes) { return JSON.stringify({ marker: programmeMarker, theme, notes }); }

const snapshot = await db.collection("weeklyMeetings").get();
let migrated = 0;
const invalid = [];
for (const doc of snapshot.docs) {
  const data = doc.data();
  if (typeof data.section !== "string" || typeof data.meetingDate !== "string" || !Array.isArray(data.entries)) { invalid.push(`${doc.id}: missing canonical section, meetingDate or entries`); continue; }
  const alreadyCanonical = ["open", "closed"].includes(data.status) && typeof data.location === "string" && typeof data.plannedActivities === "string" && typeof data.plannedBadgework === "string" && typeof data.programmeNotes === "string" && typeof data.notes === "string" && Array.isArray(data.injuries);
  if (alreadyCanonical) continue;
  const plan = legacyPlan(data.notes); migrated += 1;
  if (!checkOnly) await doc.ref.update({ status:"closed", location:plan.location, plannedActivities:activityPayload(plan.plannedActivities), plannedBadgework:badgeworkPayload(plan.plannedBadgework), programmeNotes:programmePayload(plan.theme,plan.programmeNotes), notes:plan.notes, injuries:[], updatedBy:"WEEKLY_MEETING_MIGRATION", updatedAt:FieldValue.serverTimestamp() });
}
if (invalid.length) { console.error("Weekly meeting records requiring manual repair:"); invalid.forEach((item)=>console.error(`- ${item}`)); process.exit(1); }
if (checkOnly && migrated) { console.error(`${migrated} weekly meeting record(s) still require migration.`); process.exit(1); }
console.log(checkOnly ? "Weekly meeting records are canonical." : `Weekly meeting reconciliation complete; migrated ${migrated} record(s).`);
