import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const SECTIONS = new Set(["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group", "Scouter", "All Sections"]);
const ACCESS_ROLES = new Set(["leader", "admin", "super-admin"]);
const MEMBER_STATUSES = new Set(["active", "inactive", "left"]);
const EVENT_STATUSES = new Set(["draft", "open", "closed", "completed"]);
const JOIN_STATUSES = new Set(["new", "contacted", "waiting-list", "accepted", "closed"]);
const RESPONSE_STATUSES = new Set(["new", "matched", "ignored"]);
const MEETING_TYPES = new Set(["group", "leader"]);
const LIFECYCLE_TYPES = new Set(["created", "section-transfer", "status-change", "section-and-status-change"]);
const PUBLIC_GROUP_ROLES = new Set([
  "group leader",
  "group chairperson",
  "group secretary",
  "group treasurer",
  "group quartermaster",
  "group quartermaster/bo'sun",
  "group bo'sun",
  "group youth champion",
  "deputy group leader",
  "programme scouter",
  "elected member",
  "group elected member",
  "group council elected member"
]);

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function roleKey(value) { return text(value).toLowerCase().replace(/[’‘]/g, "'").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " "); }
function isPublicGroupRole(value) {
  const role = roleKey(value);
  return PUBLIC_GROUP_ROLES.has(role) || /^(beaver|cub|scout|venture)s? programme scouter$/.test(role);
}
function isBool(value) { return typeof value === "boolean"; }
function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function validSection(value, allowEmpty = false) { const section = text(value); return (allowEmpty && !section) || SECTIONS.has(section); }

const errors = [];
const warnings = [];
const counts = new Map();
function issue(collection, id, message) { errors.push(`${collection}/${id}: ${message}`); }
function warn(collection, id, message) { warnings.push(`${collection}/${id}: ${message}`); }
async function docs(name) {
  const snapshot = await db.collection(name).get();
  counts.set(name, snapshot.size);
  return snapshot.docs;
}

const rootCollections = (await db.listCollections()).map((collection) => collection.id).sort();
console.log(`Live Firestore root collections (${rootCollections.length}): ${rootCollections.join(", ")}`);

const adminDocs = await docs("adminUsers");
const admins = new Map(adminDocs.map((doc) => [doc.id, doc.data()]));
const privilegedUids = new Set();
for (const doc of adminDocs) {
  const data = doc.data();
  if (!ACCESS_ROLES.has(data.role)) issue("adminUsers", doc.id, `unsupported role ${JSON.stringify(data.role)}`);
  if (!isBool(data.active)) issue("adminUsers", doc.id, "active must be boolean");
  if (data.uid !== undefined && text(data.uid) && text(data.uid) !== doc.id) issue("adminUsers", doc.id, "uid field does not match document id");
  const sections = Array.isArray(data.sections) ? data.sections : (text(data.section) ? [data.section] : []);
  for (const section of sections) if (!validSection(section)) issue("adminUsers", doc.id, `unsupported section ${JSON.stringify(section)}`);
  if (data.role === "admin" || data.role === "super-admin") privilegedUids.add(doc.id);
}

const organisationDocs = await docs("organisationLeadership");
const organisation = new Map(organisationDocs.map((doc) => [doc.id, doc.data()]));
for (const doc of organisationDocs) {
  const data = doc.data();
  if (!text(data.displayName)) issue("organisationLeadership", doc.id, "displayName is required");
  if (!text(data.scoutingRole)) issue("organisationLeadership", doc.id, "scoutingRole is required");
  if (!validSection(data.organisationSection)) issue("organisationLeadership", doc.id, `unsupported organisationSection ${JSON.stringify(data.organisationSection)}`);
  if (typeof data.organisationOrder !== "number" || !Number.isFinite(data.organisationOrder)) issue("organisationLeadership", doc.id, "organisationOrder must be a finite number");
  if (!isBool(data.showPublicly)) issue("organisationLeadership", doc.id, "showPublicly must be boolean");
  if (!isBool(data.active)) issue("organisationLeadership", doc.id, "active must be boolean");
  if (data.showPublicly === true && privilegedUids.has(doc.id)) issue("organisationLeadership", doc.id, "privileged admin/super-admin is marked public");
  if (data.showPublicly === true && !isPublicGroupRole(data.scoutingRole)) issue("organisationLeadership", doc.id, `public record has non-approved scouting role ${JSON.stringify(data.scoutingRole)}`);
}

const publicLeadershipDocs = await docs("publicLeadership");
for (const doc of publicLeadershipDocs) {
  const data = doc.data();
  if (privilegedUids.has(doc.id)) issue("publicLeadership", doc.id, "privileged admin/super-admin must never be public");
  if (!organisation.has(doc.id)) issue("publicLeadership", doc.id, "has no matching organisationLeadership record");
  if (!isPublicGroupRole(data.scoutingRole)) issue("publicLeadership", doc.id, `non-approved scouting role ${JSON.stringify(data.scoutingRole)}`);
  if (data.showPublicly !== true) issue("publicLeadership", doc.id, "showPublicly must be true");
  if (data.active !== true) issue("publicLeadership", doc.id, "active must be true");
  const source = organisation.get(doc.id);
  if (source && source.showPublicly !== true) issue("publicLeadership", doc.id, "source organisation record is not public");
}

for (const doc of await docs("members")) {
  const data = doc.data();
  if (!text(data.displayName) && !(text(data.firstName) || text(data.lastName))) issue("members", doc.id, "member name is missing");
  if (!validSection(data.section)) issue("members", doc.id, `unsupported section ${JSON.stringify(data.section)}`);
  if (data.status !== undefined && !MEMBER_STATUSES.has(data.status)) issue("members", doc.id, `unsupported status ${JSON.stringify(data.status)}`);
}

for (const doc of await docs("joinApplications")) {
  const data = doc.data();
  const section = text(data.section) || text(data.scoutSection);
  if (!validSection(section)) issue("joinApplications", doc.id, `unsupported/missing section ${JSON.stringify(section)}`);
  if (data.status !== undefined && !JOIN_STATUSES.has(data.status)) issue("joinApplications", doc.id, `legacy/unsupported status ${JSON.stringify(data.status)}; current statuses are new, contacted, waiting-list, accepted, closed`);
}

for (const doc of await docs("consentApplications")) {
  const data = doc.data();
  const section = text(data.section) || text(data.scoutSection);
  if (!validSection(section)) issue("consentApplications", doc.id, `unsupported/missing section ${JSON.stringify(section)}`);
  if (!text(data.formType)) warn("consentApplications", doc.id, "legacy record has no formType; current readers tolerate this");
}

for (const doc of await docs("events")) {
  const data = doc.data();
  if (!text(data.title)) issue("events", doc.id, "title is required");
  if (!validSection(data.section)) issue("events", doc.id, `unsupported section ${JSON.stringify(data.section)}`);
  if (data.status !== undefined && !EVENT_STATUSES.has(data.status)) issue("events", doc.id, `unsupported status ${JSON.stringify(data.status)}`);
  if (data.consentRequired !== undefined && !isBool(data.consentRequired)) issue("events", doc.id, "consentRequired must be boolean");
  if (data.attendance !== undefined && !isObject(data.attendance)) issue("events", doc.id, "attendance must be an object map");
  if (data.consent !== undefined && !isObject(data.consent)) issue("events", doc.id, "consent must be an object map");
}

const events = new Map((await db.collection("events").get()).docs.map((doc) => [doc.id, doc.data()]));
for (const doc of await docs("publicEvents")) {
  const data = doc.data();
  const eventId = text(data.eventId) || doc.id;
  const source = events.get(eventId);
  if (!source) issue("publicEvents", doc.id, `references missing event ${eventId}`);
  else if (source.status !== "open") issue("publicEvents", doc.id, `source event ${eventId} is ${source.status}, not open`);
}

for (const doc of await docs("eventConsentLinks")) {
  const data = doc.data();
  if (!text(data.eventId)) issue("eventConsentLinks", doc.id, "eventId is required");
  if (!validSection(data.section)) issue("eventConsentLinks", doc.id, `unsupported section ${JSON.stringify(data.section)}`);
  if (!isBool(data.active)) issue("eventConsentLinks", doc.id, "active must be boolean");
  if (text(data.eventId) && !events.has(text(data.eventId))) issue("eventConsentLinks", doc.id, `references missing event ${text(data.eventId)}`);
}

for (const doc of await docs("eventConsentResponses")) {
  const data = doc.data();
  if (!text(data.eventId)) issue("eventConsentResponses", doc.id, "eventId is required");
  if (!text(data.token)) issue("eventConsentResponses", doc.id, "token is required");
  if (data.processingStatus !== undefined && !RESPONSE_STATUSES.has(data.processingStatus)) issue("eventConsentResponses", doc.id, `unsupported processingStatus ${JSON.stringify(data.processingStatus)}`);
}

for (const doc of await docs("meetingRecords")) {
  const data = doc.data();
  if (!text(data.title)) issue("meetingRecords", doc.id, "title is required");
  if (!MEETING_TYPES.has(data.meetingType)) issue("meetingRecords", doc.id, `unsupported meetingType ${JSON.stringify(data.meetingType)}`);
  if (!validSection(data.section)) issue("meetingRecords", doc.id, `unsupported section ${JSON.stringify(data.section)}`);
  if (!text(data.meetingDate)) issue("meetingRecords", doc.id, "meetingDate is required");
  if (!Array.isArray(data.attendees)) issue("meetingRecords", doc.id, "attendees must be an array");
}

for (const doc of await docs("weeklyMeetings")) {
  const data = doc.data();
  if (!validSection(data.section)) issue("weeklyMeetings", doc.id, `unsupported section ${JSON.stringify(data.section)}`);
  if (!text(data.meetingDate)) issue("weeklyMeetings", doc.id, "meetingDate is required");
  if (!Array.isArray(data.entries)) issue("weeklyMeetings", doc.id, "entries must be an array");
}

for (const doc of await docs("memberHistory")) {
  const data = doc.data();
  if (!text(data.memberId)) issue("memberHistory", doc.id, "memberId is required");
  if (data.changeType !== undefined && !LIFECYCLE_TYPES.has(data.changeType)) issue("memberHistory", doc.id, `unsupported changeType ${JSON.stringify(data.changeType)}`);
  if (data.fromStatus !== undefined && !MEMBER_STATUSES.has(data.fromStatus)) issue("memberHistory", doc.id, `unsupported fromStatus ${JSON.stringify(data.fromStatus)}`);
  if (data.toStatus !== undefined && !MEMBER_STATUSES.has(data.toStatus)) issue("memberHistory", doc.id, `unsupported toStatus ${JSON.stringify(data.toStatus)}`);
}

for (const name of rootCollections) {
  if (!counts.has(name)) {
    const snapshot = await db.collection(name).get();
    counts.set(name, snapshot.size);
    warn(name, "*", "collection is present but has no collection-specific compatibility validator yet");
  }
}

console.log("\nCollection counts:");
for (const [name, count] of [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))) console.log(`- ${name}: ${count}`);

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const warning of warnings) console.log(`WARN ${warning}`);
}

if (errors.length) {
  console.error(`\nCompatibility errors (${errors.length}):`);
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  console.log("\nFirestore compatibility audit passed: no hard incompatibilities found in validated collections.");
}
