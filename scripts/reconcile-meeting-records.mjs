import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

const mode = process.argv[2] || "--check";
if (!["--check", "--apply"].includes(mode)) throw new Error("Usage: node scripts/reconcile-meeting-records.mjs --check|--apply");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const VALID_TYPES = new Set(["group", "leader"]);
const VALID_SECTIONS = new Set(["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group"]);
const CANONICAL_SEEDED_MEETINGS = new Map([
  ["TEST_flow_meeting_group", {
    meetingDate: "2026-08-20",
    actions: "Group Leader to publish programme plan.",
    updatedBy: "TEST_SEED"
  }],
  ["TEST_flow_meeting_leader", {
    meetingDate: "2026-08-21",
    actions: "Confirm camp kit list.",
    updatedBy: "TEST_SEED"
  }]
]);

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function stringArray(value) { return Array.isArray(value) && value.every((item) => typeof item === "string") ? value.map((item) => item.trim()).filter(Boolean) : null; }

const snapshot = await db.collection("meetingRecords").get();
const changes = [];
const blockers = [];

for (const doc of snapshot.docs) {
  const data = doc.data();
  const path = `meetingRecords/${doc.id}`;
  const patch = {};
  const deletes = [];
  const canonicalSeed = data.testData === true && data.createdBySeed === "TEST_SEED"
    ? CANONICAL_SEEDED_MEETINGS.get(doc.id)
    : undefined;

  const meetingType = text(data.meetingType);
  const section = text(data.section);
  const attendees = stringArray(data.attendees);

  if (!text(data.title)) blockers.push(`${path}: cannot reconcile missing title safely`);
  if (!VALID_TYPES.has(meetingType)) blockers.push(`${path}: cannot infer unsupported/missing meetingType safely`);
  if (!VALID_SECTIONS.has(section)) blockers.push(`${path}: cannot infer unsupported/missing section safely`);
  if (meetingType === "group" && section !== "Group") blockers.push(`${path}: group meeting section is not Group`);
  if (meetingType === "leader" && section === "Group") blockers.push(`${path}: leader meeting cannot use Group section`);
  if (!attendees || attendees.length === 0) blockers.push(`${path}: attendees must be a non-empty string array`);

  if (!text(data.meetingDate)) {
    const legacyDate = text(data.date);
    if (canonicalSeed?.meetingDate) patch.meetingDate = canonicalSeed.meetingDate;
    else if (legacyDate) patch.meetingDate = legacyDate;
    else blockers.push(`${path}: cannot reconcile missing meetingDate because no safe source value exists`);
  }

  if (typeof data.actions !== "string") {
    const legacyActions = stringArray(data.actionItems);
    if (canonicalSeed?.actions !== undefined) patch.actions = canonicalSeed.actions;
    else if (legacyActions) patch.actions = legacyActions.join("\n");
    else if (data.actions === undefined && data.actionItems === undefined) patch.actions = "";
    else blockers.push(`${path}: cannot reconcile actions/actionItems safely`);
  }

  for (const field of ["notes", "decisions"]) {
    if (data[field] === undefined) patch[field] = "";
    else if (typeof data[field] !== "string") blockers.push(`${path}: ${field} is not a string`);
  }

  if (!text(data.createdBy)) blockers.push(`${path}: createdBy is missing and cannot be inferred safely`);
  if (!text(data.updatedBy)) {
    if (canonicalSeed?.updatedBy) patch.updatedBy = canonicalSeed.updatedBy;
    else if (text(data.createdBy)) patch.updatedBy = text(data.createdBy);
    else blockers.push(`${path}: updatedBy is missing and createdBy is unavailable`);
  }

  if (data.date !== undefined) deletes.push("date");
  if (data.actionItems !== undefined) deletes.push("actionItems");

  if (Object.keys(patch).length || deletes.length) changes.push({ ref: doc.ref, path, patch, deletes });
}

if (blockers.length) {
  console.error(`Meeting reconciliation found ${blockers.length} unsafe record issue(s):`);
  for (const blocker of blockers.sort()) console.error(`- ${blocker}`);
  process.exit(1);
}

if (mode === "--check") {
  if (changes.length) {
    console.error(`Meeting reconciliation required for ${changes.length} record(s):`);
    for (const change of changes) console.error(`- ${change.path}: set [${Object.keys(change.patch).join(", ") || "none"}], remove [${change.deletes.join(", ") || "none"}]`);
    process.exit(1);
  }
  console.log(`Meeting reconciliation check passed: ${snapshot.size} record(s) already use the canonical schema.`);
  process.exit(0);
}

for (const change of changes) {
  const update = { ...change.patch, updatedAt: FieldValue.serverTimestamp() };
  for (const field of change.deletes) update[field] = FieldValue.delete();
  await change.ref.update(update);
  console.log(`Reconciled ${change.path}`);
}

console.log(`Meeting reconciliation complete: ${changes.length} record(s) updated, ${snapshot.size - changes.length} already canonical.`);
