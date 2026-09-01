import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { FIRESTORE_ROOT_COLLECTION_SET } from "./firestore-collection-contract.mjs";
import { validateOperationalIntegrity } from "./firestore-operational-integrity.mjs";
import { validateProjectionIntegrity } from "./firestore-projection-integrity.mjs";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const EXPECTED_COLLECTIONS = FIRESTORE_ROOT_COLLECTION_SET;
const DEDICATED_AUDIT_COLLECTIONS = new Set(["meetingRecords", "weeklyMeetings"]);
const SECTIONS = new Set(["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group", "Scouter", "All Sections"]);
const YOUTH_SECTIONS = new Set(["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]);
const ACCESS_ROLES = new Set(["leader", "admin", "super-admin"]);
const MEMBER_STATUSES = new Set(["active", "inactive", "left"]);
const EVENT_STATUSES = new Set(["draft", "open", "closed", "completed"]);
const JOIN_STATUSES = new Set(["new", "contacted", "waiting-list", "accepted", "closed"]);
const RESPONSE_STATUSES = new Set(["new", "matched", "ignored"]);
const PARENT_STATUSES = new Set(["pending", "approved", "rejected"]);
const LEADER_REQUEST_STATUSES = new Set(["pending", "approved", "rejected"]);
const AUDIT_CATEGORIES = new Set(["parent-access", "leader-request", "leader-access", "member", "event", "event-consent", "system"]);
const MEMBER_HISTORY_TYPES = new Set(["created", "section-transfer", "status-change", "section-and-status-change"]);
const CURRENT_CONSENT_TYPES = new Set(["youth-activity-consent", "scouter-es3-medical-advice"]);
const LEGACY_CONSENT_TYPES = new Set(["youth", "scouter"]);

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function isBool(value) { return typeof value === "boolean"; }
function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function isTimestamp(value) { return Boolean(value) && typeof value === "object" && typeof value.toDate === "function"; }
function isStringArray(value) { return Array.isArray(value) && value.every((item) => typeof item === "string"); }
function validSection(value) { return SECTIONS.has(text(value)); }
function hasDuplicates(values) { return new Set(values).size !== values.length; }

const errors = [];
const warnings = [];
const counts = new Map();
const documentsByCollection = new Map();
function fail(collection, id, message) { errors.push(`${collection}/${id}: ${message}`); }
function warn(collection, id, message) { warnings.push(`${collection}/${id}: ${message}`); }
async function docs(name) {
  if (documentsByCollection.has(name)) return documentsByCollection.get(name);
  const snapshot = await db.collection(name).get();
  counts.set(name, snapshot.size);
  documentsByCollection.set(name, snapshot.docs);
  return snapshot.docs;
}

const roots = await db.listCollections();
for (const root of roots) {
  if (!EXPECTED_COLLECTIONS.has(root.id)) fail(root.id, "*", "unexpected root collection");
}

const adminDocs = await docs("adminUsers");
const admins = new Map(adminDocs.map((doc) => [doc.id, doc.data()]));
for (const doc of adminDocs) {
  const data = doc.data();
  if (!ACCESS_ROLES.has(data.role)) fail("adminUsers", doc.id, `unsupported role ${JSON.stringify(data.role)}`);
  if (data.active !== true && data.active !== false) fail("adminUsers", doc.id, "active must be boolean");

  const canonicalSections = isStringArray(data.sections) && data.sections.length > 0;
  const hasLegacySection = data.section !== undefined;
  if (data.active === true) {
    if (!canonicalSections) fail("adminUsers", doc.id, "active profile must have a non-empty sections string array");
    if (hasLegacySection) fail("adminUsers", doc.id, "active profile must not retain legacy section field");
  } else {
    if (!canonicalSections || hasLegacySection) warn("adminUsers", doc.id, "inactive legacy profile is retained for history but is not canonical for active login");
  }

  if (isStringArray(data.sections)) {
    if (hasDuplicates(data.sections)) fail("adminUsers", doc.id, "sections contains duplicates");
    for (const section of data.sections) if (!validSection(section)) fail("adminUsers", doc.id, `unsupported section ${JSON.stringify(section)}`);
  }
  if (hasLegacySection && text(data.section) && !validSection(data.section)) fail("adminUsers", doc.id, `unsupported legacy section ${JSON.stringify(data.section)}`);
}

const memberDocs = await docs("members");
const members = new Map(memberDocs.map((doc) => [doc.id, doc.data()]));
for (const doc of memberDocs) {
  const data = doc.data();
  if (!text(data.displayName)) fail("members", doc.id, "displayName is required");
  if (!YOUTH_SECTIONS.has(text(data.section))) fail("members", doc.id, `unsupported member section ${JSON.stringify(data.section)}`);
  if (!MEMBER_STATUSES.has(data.status)) fail("members", doc.id, `unsupported status ${JSON.stringify(data.status)}`);
  if (!new Set(["manual", "join-application"]).has(data.source)) fail("members", doc.id, `unsupported source ${JSON.stringify(data.source)}`);
}

for (const doc of await docs("parentAccounts")) {
  const data = doc.data();
  if (text(data.uid) !== doc.id) fail("parentAccounts", doc.id, "uid must match document id");
  if (!text(data.email)) fail("parentAccounts", doc.id, "email is required");
  if (!text(data.displayName)) fail("parentAccounts", doc.id, "displayName is required");
  if (!PARENT_STATUSES.has(data.status)) fail("parentAccounts", doc.id, `unsupported status ${JSON.stringify(data.status)}`);
  if (!isStringArray(data.memberIds)) fail("parentAccounts", doc.id, "memberIds must be a string array");
  if (!isStringArray(data.linkedSections)) fail("parentAccounts", doc.id, "linkedSections must be a string array");
  const memberIds = isStringArray(data.memberIds) ? data.memberIds : [];
  const linkedSections = isStringArray(data.linkedSections) ? data.linkedSections : [];
  if (hasDuplicates(memberIds)) fail("parentAccounts", doc.id, "memberIds contains duplicates");
  if (hasDuplicates(linkedSections)) fail("parentAccounts", doc.id, "linkedSections contains duplicates");
  if (data.status !== "approved" && (memberIds.length || linkedSections.length)) fail("parentAccounts", doc.id, "non-approved account retains member/section links");
  for (const memberId of memberIds) {
    const member = members.get(memberId);
    if (!member) fail("parentAccounts", doc.id, `references missing member ${memberId}`);
    else if (!linkedSections.includes(text(member.section))) fail("parentAccounts", doc.id, `linkedSections omits section for ${memberId}`);
  }
  for (const section of linkedSections) if (!YOUTH_SECTIONS.has(text(section))) fail("parentAccounts", doc.id, `unsupported linked section ${JSON.stringify(section)}`);
  if (["approved", "rejected"].includes(data.status)) {
    if (!text(data.reviewedBy)) fail("parentAccounts", doc.id, "reviewedBy is required after review");
    if (!isTimestamp(data.reviewedAt)) fail("parentAccounts", doc.id, "reviewedAt must be a timestamp after review");
  }
}

for (const doc of await docs("leaderRegistrationRequests")) {
  const data = doc.data();
  if (text(data.uid) !== doc.id) fail("leaderRegistrationRequests", doc.id, "uid must match document id");
  if (!text(data.fullName) || !text(data.email)) fail("leaderRegistrationRequests", doc.id, "fullName and email are required");
  if (data.privacyConfirmed !== true) fail("leaderRegistrationRequests", doc.id, "privacyConfirmed must be true");
  if (!LEADER_REQUEST_STATUSES.has(data.status)) fail("leaderRegistrationRequests", doc.id, `unsupported status ${JSON.stringify(data.status)}`);
  if (!isTimestamp(data.submittedAt)) fail("leaderRegistrationRequests", doc.id, "submittedAt must be a timestamp");
  if (["approved", "rejected"].includes(data.status)) {
    if (!text(data.reviewedBy)) fail("leaderRegistrationRequests", doc.id, "reviewedBy is required after review");
    if (!isTimestamp(data.reviewedAt)) fail("leaderRegistrationRequests", doc.id, "reviewedAt must be a timestamp after review");
  }
}

const joinDocs = await docs("joinApplications");
const joins = new Map(joinDocs.map((doc) => [doc.id, doc.data()]));
for (const doc of joinDocs) {
  const data = doc.data();
  if (!YOUTH_SECTIONS.has(text(data.section))) fail("joinApplications", doc.id, `unsupported section ${JSON.stringify(data.section)}`);
  if (data.scoutSection !== undefined) fail("joinApplications", doc.id, "legacy scoutSection field must not be present");
  if (!JOIN_STATUSES.has(data.status)) fail("joinApplications", doc.id, `unsupported status ${JSON.stringify(data.status)}`);
  if (data.source !== "website") fail("joinApplications", doc.id, `source must be website, found ${JSON.stringify(data.source)}`);
}

for (const [id, data] of members) {
  if (data.source === "join-application") {
    const sourceId = text(data.sourceJoinApplicationId);
    if (!sourceId || !joins.has(sourceId)) fail("members", id, "join-application source is missing or invalid");
  }
}

const eventDocs = await docs("events");
const events = new Map(eventDocs.map((doc) => [doc.id, doc.data()]));
for (const doc of eventDocs) {
  const data = doc.data();
  if (!text(data.title)) fail("events", doc.id, "title is required");
  if (!validSection(data.section) || text(data.section) === "Scouter") fail("events", doc.id, `unsupported section ${JSON.stringify(data.section)}`);
  if (!EVENT_STATUSES.has(data.status)) fail("events", doc.id, `unsupported status ${JSON.stringify(data.status)}`);
  if (data.consentRequired !== undefined && !isBool(data.consentRequired)) fail("events", doc.id, "consentRequired must be boolean");
  if (data.attendance !== undefined && !isObject(data.attendance)) fail("events", doc.id, "attendance must be an object map");
  if (data.consent !== undefined && !isObject(data.consent)) fail("events", doc.id, "consent must be an object map");
}

for (const doc of await docs("publicEvents")) {
  const data = doc.data();
  const eventId = text(data.eventId) || doc.id;
  const source = events.get(eventId);
  if (!source) fail("publicEvents", doc.id, `references missing event ${eventId}`);
  else if (source.status !== "open") fail("publicEvents", doc.id, `source event is ${JSON.stringify(source.status)}, not open`);
}

const linkDocs = await docs("eventConsentLinks");
const links = new Map(linkDocs.map((doc) => [doc.id, doc.data()]));
for (const doc of linkDocs) {
  const data = doc.data();
  if (!text(data.eventId) || !events.has(text(data.eventId))) fail("eventConsentLinks", doc.id, "eventId is missing or references no event");
  if (!validSection(data.section) || text(data.section) === "Scouter") fail("eventConsentLinks", doc.id, `unsupported section ${JSON.stringify(data.section)}`);
  if (!isBool(data.active)) fail("eventConsentLinks", doc.id, "active must be boolean");
}

for (const doc of await docs("eventConsentResponses")) {
  const data = doc.data();
  if (!text(data.eventId)) fail("eventConsentResponses", doc.id, "eventId is required");
  if (!text(data.token) || !links.has(text(data.token))) fail("eventConsentResponses", doc.id, "token is missing or references no consent link");
  else if (text(links.get(text(data.token)).eventId) !== text(data.eventId)) fail("eventConsentResponses", doc.id, "eventId differs from source consent link");
  if (!RESPONSE_STATUSES.has(data.processingStatus)) fail("eventConsentResponses", doc.id, `unsupported processingStatus ${JSON.stringify(data.processingStatus)}`);
}

for (const doc of await docs("consentApplications")) {
  const data = doc.data();
  const section = text(data.section) || text(data.scoutSection);
  if (!validSection(section)) fail("consentApplications", doc.id, `unsupported/missing section ${JSON.stringify(section)}`);
  if (data.scoutSection !== undefined) warn("consentApplications", doc.id, "legacy scoutSection is retained and tolerated by current readers; migrate when safely attributable");
  if (data.source !== "website") fail("consentApplications", doc.id, `source must be website, found ${JSON.stringify(data.source)}`);
  if (!CURRENT_CONSENT_TYPES.has(data.formType)) {
    if (LEGACY_CONSENT_TYPES.has(data.formType)) warn("consentApplications", doc.id, `legacy formType ${JSON.stringify(data.formType)} is retained for backwards compatibility`);
    else fail("consentApplications", doc.id, `unsupported formType ${JSON.stringify(data.formType)}`);
  }
  if (section === "Scouter" && data.formType !== "scouter" && data.formType !== "scouter-es3-medical-advice") {
    fail("consentApplications", doc.id, "Scouter section must use a scouter consent form type");
  }
}

for (const doc of await docs("memberHistory")) {
  const data = doc.data();
  if (!text(data.memberId) || !members.has(text(data.memberId))) fail("memberHistory", doc.id, "memberId is missing or references no member");
  if (!MEMBER_HISTORY_TYPES.has(data.changeType)) fail("memberHistory", doc.id, `unsupported changeType ${JSON.stringify(data.changeType)}`);
}

const organisationDocs = await docs("organisationLeadership");
const organisation = new Map(organisationDocs.map((doc) => [doc.id, doc.data()]));
for (const doc of organisationDocs) {
  const data = doc.data();
  if (!admins.has(doc.id)) fail("organisationLeadership", doc.id, "has no adminUsers identity source");
  if (!text(data.displayName) || !text(data.scoutingRole)) fail("organisationLeadership", doc.id, "displayName and scoutingRole are required");
  if (!validSection(data.organisationSection)) fail("organisationLeadership", doc.id, `unsupported organisationSection ${JSON.stringify(data.organisationSection)}`);
  if (!isBool(data.showPublicly) || !isBool(data.active)) fail("organisationLeadership", doc.id, "showPublicly and active must be boolean");
}

for (const doc of await docs("publicLeadership")) {
  const data = doc.data();
  const source = organisation.get(doc.id);
  const access = admins.get(doc.id);
  if (!source) fail("publicLeadership", doc.id, "has no organisationLeadership source");
  if (!access || access.role !== "leader" || access.active !== true) fail("publicLeadership", doc.id, "has no active leader access source");
  if (data.publicProjectionVersion !== 2 || data.sourceAccessRole !== "leader") fail("publicLeadership", doc.id, "public projection metadata is not canonical");
  if (data.showPublicly !== true || data.active !== true) fail("publicLeadership", doc.id, "public projection must be active and public");
}

for (const doc of await docs("publicSiteContent")) {
  const data = doc.data();
  if (doc.id !== "TEST_site") fail("publicSiteContent", doc.id, "unexpected document id");
  if (data.contentVersion !== 1 || data.testData !== true || data.testSeed !== "public-site-content-v1" || data.createdBySeed !== "TEST_SEED") {
    fail("publicSiteContent", doc.id, "public content provenance/version is not canonical");
  }
}

for (const doc of await docs("auditLog")) {
  const data = doc.data();
  const actor = admins.get(text(data.actorUid));
  if (!actor) fail("auditLog", doc.id, "actorUid references no adminUsers profile");
  if (!text(data.actorEmail)) fail("auditLog", doc.id, "actorEmail is required");
  if (!AUDIT_CATEGORIES.has(data.category)) fail("auditLog", doc.id, `unsupported category ${JSON.stringify(data.category)}`);
  if (!isTimestamp(data.createdAt)) fail("auditLog", doc.id, "createdAt must be a timestamp");
}

for (const collectionName of DEDICATED_AUDIT_COLLECTIONS) {
  const snapshot = await db.collection(collectionName).get();
  counts.set(collectionName, snapshot.size);
  warn(collectionName, "*", "validated by its dedicated compatibility audit in the same workflow");
}

for (const collectionName of EXPECTED_COLLECTIONS) await docs(collectionName);
const operationalCollections = new Map([...documentsByCollection].map(([name, documents]) => [
  name,
  new Map(documents.map((document) => [document.id, document.data()]))
]));
for (const issue of validateOperationalIntegrity(operationalCollections)) errors.push(issue);
for (const issue of validateProjectionIntegrity(operationalCollections)) errors.push(issue);

console.log("Live Firestore compatibility summary:");
for (const [name, count] of [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))) console.log(`- ${name}: ${count}`);
if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  for (const warning of warnings.sort()) console.log(`- ${warning}`);
}
if (errors.length) {
  console.error(`Live Firestore compatibility audit failed with ${errors.length} issue(s):`);
  for (const error of errors.sort()) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Live Firestore data matches the current non-meeting collection contracts; supported historical records are reported as warnings, and meetingRecords/weeklyMeetings are covered by dedicated audits.");
