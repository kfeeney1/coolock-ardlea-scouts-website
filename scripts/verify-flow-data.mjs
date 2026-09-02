import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const TEST_SEED = "full-system-flows-v1";

const seedDate = process.env.E2E_SEED_DATE?.trim() || new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(seedDate)) throw new Error("E2E_SEED_DATE must use YYYY-MM-DD.");
const seedDay = new Date(`${seedDate}T12:00:00.000Z`);
if (Number.isNaN(seedDay.getTime()) || seedDay.toISOString().slice(0, 10) !== seedDate) {
  throw new Error("E2E_SEED_DATE must be a real calendar date.");
}
function relativeDate(days) {
  const value = new Date(seedDay);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function fail(message) { throw new Error(`Flow seed verification failed: ${message}`); }
async function seeded(name) {
  const snapshot = await db.collection(name).where("testSeed", "==", TEST_SEED).get();
  return snapshot.docs;
}
function values(docs, field) { return new Set(docs.map((doc) => doc.data()[field])); }
function requireFields(collection, docs, fields) {
  for (const doc of docs) {
    const data = doc.data();
    for (const field of fields) {
      if (!(field in data)) fail(`${collection}/${doc.id} missing canonical field ${field}`);
    }
  }
}
function forbidFields(collection, docs, fields) {
  for (const doc of docs) {
    const data = doc.data();
    for (const field of fields) {
      if (field in data) fail(`${collection}/${doc.id} contains legacy field ${field}`);
    }
  }
}
function requireDate(collection, doc, field, expected) {
  const actual = doc.data()[field];
  if (actual !== expected) fail(`${collection}/${doc.id} ${field}: expected ${expected}, found ${actual}`);
}

const expectedMinimums = {
  events: 6,
  publicEvents: 3,
  joinApplications: 5,
  consentApplications: 3,
  eventConsentLinks: 2,
  eventConsentResponses: 3,
  meetingRecords: 2,
  memberHistory: 4,
  leaderRegistrationRequests: 3,
  parentAccounts: 2
};
const all = {};
for (const [collection, minimum] of Object.entries(expectedMinimums)) {
  const docs = await seeded(collection);
  all[collection] = docs;
  if (docs.length < minimum) fail(`${collection}: expected at least ${minimum}, found ${docs.length}`);
}

const joins = all.joinApplications;
for (const status of ["new", "contacted", "waiting-list", "accepted", "closed"]) if (!values(joins, "status").has(status)) fail(`joinApplications missing ${status}`);
requireFields("joinApplications", joins, ["childFirstName", "childLastName", "dateOfBirth", "parentName", "emailAddress", "mobileNumber", "emergencyContactName", "emergencyContactPhone", "section", "status", "source", "submittedAt"]);
forbidFields("joinApplications", joins, ["childDob", "dob", "childName", "name", "phone", "phoneNumber", "parentPhone", "parentMobile", "scoutSection"]);

const events = all.events;
for (const status of ["draft", "open", "closed", "completed"]) if (!values(events, "status").has(status)) fail(`events missing ${status}`);
for (const section of ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "All Sections"]) if (!values(events, "section").has(section)) fail(`events missing ${section}`);
requireFields("events", events, ["title", "description", "eventType", "section", "location", "meetingPoint", "returnDetails", "leaderNotes", "startDate", "endDate", "status", "consentRequired", "attendance", "consent"]);
const eventById = new Map(events.map((doc) => [doc.id, doc]));
const expectedEventDates = {
  TEST_flow_event_beavers_open: [relativeDate(14), relativeDate(14)],
  TEST_flow_event_cubs_draft: [relativeDate(35), relativeDate(37)],
  TEST_flow_event_scouts_closed: [relativeDate(-30), relativeDate(-30)],
  TEST_flow_event_ventures_completed: [relativeDate(-45), relativeDate(-45)],
  TEST_flow_event_rovers_open: [relativeDate(60), relativeDate(60)],
  TEST_flow_event_all_sections: [relativeDate(90), relativeDate(90)]
};
for (const [id, [startDate, endDate]] of Object.entries(expectedEventDates)) {
  const doc = eventById.get(id);
  if (!doc) fail(`events missing canonical ${id}`);
  requireDate("events", doc, "startDate", startDate);
  requireDate("events", doc, "endDate", endDate);
}

const publicEvents = all.publicEvents;
requireFields("publicEvents", publicEvents, ["eventId", "title", "description", "eventType", "section", "location", "startDate", "endDate"]);
forbidFields("publicEvents", publicEvents, ["status"]);
for (const doc of publicEvents) {
  const data = doc.data();
  const source = eventById.get(data.eventId);
  if (!source) fail(`publicEvents/${doc.id} points to missing event ${data.eventId}`);
  if (source.data().status !== "open") fail(`publicEvents/${doc.id} points to non-open event ${data.eventId}`);
  if (data.startDate !== source.data().startDate || data.endDate !== source.data().endDate) fail(`publicEvents/${doc.id} date projection drifted from ${data.eventId}`);
}

const consents = all.consentApplications;
const formTypes = values(consents, "formType");
if (!formTypes.has("youth-activity-consent")) fail("consentApplications missing youth-activity-consent");
if (!formTypes.has("scouter-es3-medical-advice")) fail("consentApplications missing scouter-es3-medical-advice");
if (formTypes.has("youth") || formTypes.has("scouter")) fail("consentApplications contains legacy formType");
requireFields("consentApplications", consents, ["section", "formType", "formVersion", "status", "source", "submittedAt"]);
forbidFields("consentApplications", consents, ["scoutSection", "expiryDate", "medicalConditions", "medicationRequired"]);
for (const doc of consents) {
  const data = doc.data();
  if (data.formType === "youth-activity-consent") {
    for (const field of ["memberId", "childName", "childDOB", "consentFrom", "consentTo", "medicationManagement"]) if (!(field in data)) fail(`consentApplications/${doc.id} missing youth field ${field}`);
    if (data.consentFrom !== relativeDate(-10) || data.consentTo !== relativeDate(330)) fail(`consentApplications/${doc.id} active consent window is not time-stable`);
  }
  if (data.formType === "scouter-es3-medical-advice") {
    for (const field of ["name", "dob", "signature", "medicationManagement"]) if (!(field in data)) fail(`consentApplications/${doc.id} missing scouter field ${field}`);
  }
}

const links = all.eventConsentLinks;
requireFields("eventConsentLinks", links, ["eventId", "title", "description", "eventType", "section", "location", "meetingPoint", "returnDetails", "startDate", "endDate", "consentRequired", "active"]);
for (const doc of links) {
  const data = doc.data();
  const source = eventById.get(data.eventId);
  if (!source) fail(`eventConsentLinks/${doc.id} points to missing event ${data.eventId}`);
  if (data.startDate !== source.data().startDate || data.endDate !== source.data().endDate) fail(`eventConsentLinks/${doc.id} date projection drifted from ${data.eventId}`);
}
const activeBeaverLink = links.find((doc) => doc.id === "TESTFLOWBEAVERSOPEN2026");
if (!activeBeaverLink || activeBeaverLink.data().active !== true) fail("canonical Beavers event-consent link must remain active");
requireDate("eventConsentLinks", activeBeaverLink, "startDate", relativeDate(14));

const responses = all.eventConsentResponses;
for (const status of ["new", "matched", "ignored"]) if (!values(responses, "processingStatus").has(status)) fail(`eventConsentResponses missing ${status}`);
requireFields("eventConsentResponses", responses, ["token", "eventId", "childName", "dateOfBirth", "parentName", "attendance", "consentGiven", "emergencyDetailsConfirmed", "medicalDetailsChanged", "processingStatus", "submittedAt"]);

const meetings = all.meetingRecords;
for (const type of ["group", "leader"]) if (!values(meetings, "meetingType").has(type)) fail(`meetingRecords missing ${type}`);
requireFields("meetingRecords", meetings, ["title", "meetingType", "section", "meetingDate", "attendees", "notes", "decisions", "actions", "createdBy", "createdAt", "updatedBy"]);
forbidFields("meetingRecords", meetings, ["date", "actionItems"]);
const groupMeeting = meetings.find((doc) => doc.id === "TEST_flow_meeting_group");
const leaderMeeting = meetings.find((doc) => doc.id === "TEST_flow_meeting_leader");
if (!groupMeeting || !leaderMeeting) fail("meetingRecords missing canonical past meeting fixtures");
requireDate("meetingRecords", groupMeeting, "meetingDate", relativeDate(-14));
requireDate("meetingRecords", leaderMeeting, "meetingDate", relativeDate(-13));

const history = all.memberHistory;
for (const type of ["created", "section-transfer", "status-change", "section-and-status-change"]) if (!values(history, "changeType").has(type)) fail(`memberHistory missing ${type}`);
requireFields("memberHistory", history, ["memberId", "memberName", "changeType", "fromSection", "toSection", "fromStatus", "toStatus", "changedBy", "changedAt"]);

const requests = all.leaderRegistrationRequests;
for (const status of ["pending", "approved", "rejected"]) if (!values(requests, "status").has(status)) fail(`leaderRegistrationRequests missing ${status}`);
requireFields("leaderRegistrationRequests", requests, ["uid", "fullName", "email", "mobileNumber", "requestedRole", "requestedSection", "reason", "privacyConfirmed", "status", "submittedAt", "reviewedAt", "reviewedBy", "reviewNote"]);

const parents = all.parentAccounts;
for (const status of ["pending", "rejected"]) if (!values(parents, "status").has(status)) fail(`parentAccounts missing ${status}`);
requireFields("parentAccounts", parents, ["uid", "email", "displayName", "mobileNumber", "status", "memberIds", "linkedSections", "reviewedBy", "reviewedAt", "createdAt"]);

console.log(`Full-system canonical TEST flow coverage verified successfully relative to ${seedDate}.`);
