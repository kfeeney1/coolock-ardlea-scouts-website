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
const PARENT_STATUSES = new Set(["pending", "approved", "rejected"]);
const LEADER_REQUEST_STATUSES = new Set(["pending", "approved", "rejected"]);
const LEADER_REQUEST_ROLES = new Set(["Scouter", "Section Leader", "Group Leader", "Other", "Programme Scouter"]);
const LEADER_REQUEST_SECTIONS = new Set(["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group", "Other"]);
const PUBLIC_GROUP_ROLES = new Set([
  "group leader", "group chairperson", "group secretary", "group treasurer",
  "group quartermaster", "group quartermaster/bo'sun", "group bo'sun", "group youth champion"
]);
const PUBLIC_SECTIONS = new Set(["beavers", "cubs", "scouts", "ventures", "rovers"]);

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function roleKey(value) { return text(value).toLowerCase().replace(/[’‘]/g, "'").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " "); }
function sectionKey(value) { return text(value).toLowerCase(); }
// Group visibility is role-restricted; section visibility is title-agnostic so all opted-in section leaders/scouters are covered.
function isPublicOrganisationRole(role, section) {
  if (PUBLIC_SECTIONS.has(sectionKey(section))) return Boolean(roleKey(role));
  return sectionKey(section) === "group" && PUBLIC_GROUP_ROLES.has(roleKey(role));
}
function isBool(value) { return typeof value === "boolean"; }
function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function isTimestamp(value) { return Boolean(value) && typeof value === "object" && typeof value.toDate === "function"; }
function isStringArray(value) { return Array.isArray(value) && value.every((item) => typeof item === "string"); }
function validSection(value) { return SECTIONS.has(text(value)); }
function hasDuplicates(values) { return new Set(values).size !== values.length; }

const errors = [], warnings = [], counts = new Map();
function issue(collection, id, message) { errors.push(`${collection}/${id}: ${message}`); }
function warn(collection, id, message) { warnings.push(`${collection}/${id}: ${message}`); }
async function docs(name) { const snapshot = await db.collection(name).get(); counts.set(name, snapshot.size); return snapshot.docs; }

const rootCollections = (await db.listCollections()).map((c) => c.id).sort();
console.log(`Live Firestore root collections (${rootCollections.length}): ${rootCollections.join(", ")}`);

const adminDocs = await docs("adminUsers");
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
  if (data.showPublicly === true && !isPublicOrganisationRole(data.scoutingRole, data.organisationSection)) issue("organisationLeadership", doc.id, `public record is not eligible for section/role ${JSON.stringify(data.organisationSection)} / ${JSON.stringify(data.scoutingRole)}`);
}

for (const doc of await docs("publicLeadership")) {
  const data = doc.data();
  if (privilegedUids.has(doc.id)) issue("publicLeadership", doc.id, "privileged admin/super-admin must never be public");
  if (!organisation.has(doc.id)) issue("publicLeadership", doc.id, "has no matching organisationLeadership record");
  if (!isPublicOrganisationRole(data.scoutingRole, data.organisationSection)) issue("publicLeadership", doc.id, `record is not eligible for section/role ${JSON.stringify(data.organisationSection)} / ${JSON.stringify(data.scoutingRole)}`);
  if (data.showPublicly !== true) issue("publicLeadership", doc.id, "showPublicly must be true");
  if (data.active !== true) issue("publicLeadership", doc.id, "active must be true");
  const source = organisation.get(doc.id);
  if (source && source.showPublicly !== true) issue("publicLeadership", doc.id, "source organisation record is not public");
}

const memberDocs = await docs("members");
const members = new Map(memberDocs.map((doc) => [doc.id, doc.data()]));
for (const doc of memberDocs) {
  const data = doc.data();
  if (!text(data.displayName) && !(text(data.firstName) || text(data.lastName))) issue("members", doc.id, "member name is missing");
  if (!validSection(data.section)) issue("members", doc.id, `unsupported section ${JSON.stringify(data.section)}`);
  if (data.status !== undefined && !MEMBER_STATUSES.has(data.status)) issue("members", doc.id, `unsupported status ${JSON.stringify(data.status)}`);
}

for (const doc of await docs("parentAccounts")) {
  const data = doc.data();
  if (text(data.uid) !== doc.id) issue("parentAccounts", doc.id, "uid is required and must match document id");
  if (!text(data.email)) issue("parentAccounts", doc.id, "email is required");
  if (!text(data.displayName)) issue("parentAccounts", doc.id, "displayName is required");
  if (data.mobileNumber !== undefined && typeof data.mobileNumber !== "string") issue("parentAccounts", doc.id, "mobileNumber must be a string when present");
  if (!PARENT_STATUSES.has(data.status)) issue("parentAccounts", doc.id, `unsupported status ${JSON.stringify(data.status)}`);
  if (!isStringArray(data.memberIds)) issue("parentAccounts", doc.id, "memberIds must be an array of strings");
  if (!isStringArray(data.linkedSections)) issue("parentAccounts", doc.id, "linkedSections must be an array of strings");
  const memberIds = isStringArray(data.memberIds) ? data.memberIds : [];
  const linkedSections = isStringArray(data.linkedSections) ? data.linkedSections : [];
  if (hasDuplicates(memberIds)) issue("parentAccounts", doc.id, "memberIds contains duplicates");
  if (hasDuplicates(linkedSections)) issue("parentAccounts", doc.id, "linkedSections contains duplicates");
  for (const memberId of memberIds) {
    const member = members.get(memberId);
    if (!member) issue("parentAccounts", doc.id, `references missing member ${memberId}`);
    else if (text(member.section) && !linkedSections.includes(text(member.section))) issue("parentAccounts", doc.id, `linkedSections does not include section for member ${memberId}`);
  }
  for (const section of linkedSections) if (!validSection(section)) issue("parentAccounts", doc.id, `unsupported linked section ${JSON.stringify(section)}`);
  if (data.status !== "approved" && (memberIds.length || linkedSections.length)) issue("parentAccounts", doc.id, "non-approved account must not retain member or section links");
  if (data.status === "approved" || data.status === "rejected") {
    if (!text(data.reviewedBy)) issue("parentAccounts", doc.id, "reviewedBy is required after review");
    if (!isTimestamp(data.reviewedAt)) issue("parentAccounts", doc.id, "reviewedAt must be a Firestore timestamp after review");
  }
  if (data.createdAt !== undefined && !isTimestamp(data.createdAt)) issue("parentAccounts", doc.id, "createdAt must be a Firestore timestamp when present");
  if (data.updatedAt !== undefined && !isTimestamp(data.updatedAt)) issue("parentAccounts", doc.id, "updatedAt must be a Firestore timestamp when present");
}

for (const doc of await docs("leaderRegistrationRequests")) {
  const data = doc.data();
  if (text(data.uid) !== doc.id) issue("leaderRegistrationRequests", doc.id, "uid is required and must match document id");
  if (!text(data.fullName)) issue("leaderRegistrationRequests", doc.id, "fullName is required");
  if (!text(data.email)) issue("leaderRegistrationRequests", doc.id, "email is required");
  if (data.mobileNumber !== undefined && typeof data.mobileNumber !== "string") issue("leaderRegistrationRequests", doc.id, "mobileNumber must be a string when present");
  if (!text(data.requestedRole)) issue("leaderRegistrationRequests", doc.id, "requestedRole is required");
  else if (!LEADER_REQUEST_ROLES.has(text(data.requestedRole))) warn("leaderRegistrationRequests", doc.id, `requestedRole ${JSON.stringify(data.requestedRole)} is legacy/unrecognised by the current form`);
  if (!text(data.requestedSection)) issue("leaderRegistrationRequests", doc.id, "requestedSection is required");
  else if (!LEADER_REQUEST_SECTIONS.has(text(data.requestedSection))) issue("leaderRegistrationRequests", doc.id, `unsupported requestedSection ${JSON.stringify(data.requestedSection)}`);
  if (typeof data.reason !== "string") issue("leaderRegistrationRequests", doc.id, "reason must be a string");
  if (data.privacyConfirmed !== true) issue("leaderRegistrationRequests", doc.id, "privacyConfirmed must be true");
  if (!LEADER_REQUEST_STATUSES.has(data.status)) issue("leaderRegistrationRequests", doc.id, `unsupported status ${JSON.stringify(data.status)}`);
  if (!isTimestamp(data.submittedAt)) issue("leaderRegistrationRequests", doc.id, "submittedAt must be a Firestore timestamp");
  if (data.reviewNote !== undefined && typeof data.reviewNote !== "string") issue("leaderRegistrationRequests", doc.id, "reviewNote must be a string when present");
  if (data.status === "approved" || data.status === "rejected") {
    if (!text(data.reviewedBy)) issue("leaderRegistrationRequests", doc.id, "reviewedBy is required after review");
    if (!isTimestamp(data.reviewedAt)) issue("leaderRegistrationRequests", doc.id, "reviewedAt must be a Firestore timestamp after review");
  } else {
    if (data.reviewedAt !== null && data.reviewedAt !== undefined) issue("leaderRegistrationRequests", doc.id, "pending request must not have reviewedAt");
    if (text(data.reviewedBy)) issue("leaderRegistrationRequests", doc.id, "pending request must not have reviewedBy");
  }
}

for (const doc of await docs("joinApplications")) {
  const data = doc.data(), section = text(data.section) || text(data.scoutSection);
  if (!validSection(section)) issue("joinApplications", doc.id, `unsupported/missing section ${JSON.stringify(section)}`);
  if (data.status !== undefined && !JOIN_STATUSES.has(data.status)) issue("joinApplications", doc.id, `legacy/unsupported status ${JSON.stringify(data.status)}`);
}
for (const doc of await docs("consentApplications")) {
  const data = doc.data(), section = text(data.section) || text(data.scoutSection);
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
  const data = doc.data(), eventId = text(data.eventId) || doc.id, source = events.get(eventId);
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
  if (!Array.isArray(data.attendees)) issue("meetingRecords", doc.id, "attendees must be an array");
  if (!Array.isArray(data.actionItems)) issue("meetingRecords", doc.id, "actionItems must be an array");
}
for (const doc of await docs("memberHistory")) {
  const data = doc.data();
  if (!text(data.memberId)) issue("memberHistory", doc.id, "memberId is required");
  if (!LIFECYCLE_TYPES.has(data.changeType)) issue("memberHistory", doc.id, `unsupported changeType ${JSON.stringify(data.changeType)}`);
  if (data.fromSection !== undefined && !validSection(data.fromSection)) issue("memberHistory", doc.id, `unsupported fromSection ${JSON.stringify(data.fromSection)}`);
  if (data.toSection !== undefined && !validSection(data.toSection)) issue("memberHistory", doc.id, `unsupported toSection ${JSON.stringify(data.toSection)}`);
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
if (warnings.length) { console.log(`\nWarnings (${warnings.length}):`); for (const warning of warnings) console.log(`WARN ${warning}`); }
if (errors.length) {
  console.error(`\nCompatibility errors (${errors.length}):`);
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  console.log("\nNo hard compatibility issues found. Live Firestore data matches the current website contracts covered by this audit.");
}
