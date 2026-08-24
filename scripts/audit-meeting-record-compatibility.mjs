import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const VALID_TYPES = new Set(["group", "leader"]);
const VALID_SECTIONS = new Set(["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group"]);
const FULL_HISTORY_ROLES = new Set(["Group Leader", "Group Secretary"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

const errors = [];
const warnings = [];
function fail(path, message) { errors.push(`${path}: ${message}`); }
function warn(path, message) { warnings.push(`${path}: ${message}`); }

const [meetingSnapshot, adminSnapshot, organisationSnapshot] = await Promise.all([
  db.collection("meetingRecords").get(),
  db.collection("adminUsers").get(),
  db.collection("organisationLeadership").get()
]);

const adminUsers = new Map(adminSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const organisation = new Map(organisationSnapshot.docs.map((doc) => [doc.id, doc.data()]));

for (const doc of meetingSnapshot.docs) {
  const data = doc.data();
  const path = `meetingRecords/${doc.id}`;
  const meetingType = text(data.meetingType);
  const section = text(data.section);

  if (!text(data.title)) fail(path, "title is required");
  if (!VALID_TYPES.has(meetingType)) fail(path, `meetingType must be group or leader, found ${JSON.stringify(data.meetingType)}`);
  if (!VALID_SECTIONS.has(section)) fail(path, `section is unsupported or missing: ${JSON.stringify(data.section)}`);
  if (meetingType === "group" && section !== "Group") fail(path, "group meetings must use section Group");
  if (meetingType === "leader" && section === "Group") fail(path, "leader meetings must use a youth section, not Group");
  if (!text(data.meetingDate)) fail(path, "meetingDate is required");
  if (!isStringArray(data.attendees) || data.attendees.length === 0) fail(path, "attendees must be a non-empty string array");
  for (const field of ["notes", "decisions", "actions"]) {
    if (data[field] !== undefined && typeof data[field] !== "string") fail(path, `${field} must be a string when present`);
  }
  if (!text(data.createdBy)) fail(path, "createdBy is required");
  if (!text(data.updatedBy)) fail(path, "updatedBy is required");

  if (data.date !== undefined) warn(path, "legacy date field is still present; reconcile before relying on canonical readers");
  if (data.actionItems !== undefined) warn(path, "legacy actionItems field is still present; reconcile before relying on canonical readers");
}

for (const [uid, org] of organisation) {
  const role = text(org.scoutingRole);
  if (!FULL_HISTORY_ROLES.has(role)) continue;
  const access = adminUsers.get(uid);
  const path = `organisationLeadership/${uid}`;
  if (!access) {
    fail(path, `${role} has no matching adminUsers access profile`);
    continue;
  }
  if (access.active !== true) fail(path, `${role} access profile is not active`);
  if (access.role !== "leader") fail(path, `${role} must retain leader system role rather than receiving admin privileges`);
  if (!Array.isArray(access.sections) || !access.sections.includes("Group")) {
    fail(path, `${role} must have Group in adminUsers.sections so the role identity remains canonical`);
  }
  if (org.active !== true) fail(path, `${role} organisation record is not active`);
  if (text(org.organisationSection) !== "Group") fail(path, `${role} organisationSection must be Group`);
}

console.log(`Meeting compatibility audit: ${meetingSnapshot.size} meeting records, ${organisationSnapshot.size} organisation records.`);
if (warnings.length) {
  console.warn(`Compatibility warnings (${warnings.length}):`);
  for (const warning of warnings.sort()) console.warn(`- ${warning}`);
}
if (errors.length) {
  console.error(`Meeting compatibility audit failed with ${errors.length} issue(s):`);
  for (const error of errors.sort()) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Meeting record data and Group Leader/Group Secretary identities are compatible with the current application contract.");
