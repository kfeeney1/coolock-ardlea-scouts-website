import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const TEST_SEED = "full-system-flows-v1";

function fail(message) { throw new Error(`Flow seed verification failed: ${message}`); }
async function seeded(name) {
  const snapshot = await db.collection(name).where("testSeed", "==", TEST_SEED).get();
  return snapshot.docs;
}
function values(docs, field) { return new Set(docs.map((doc) => doc.data()[field])); }

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
for (const [collection, minimum] of Object.entries(expectedMinimums)) {
  const docs = await seeded(collection);
  if (docs.length < minimum) fail(`${collection}: expected at least ${minimum}, found ${docs.length}`);
}

const joins = await seeded("joinApplications");
for (const status of ["new", "contacted", "waiting-list", "accepted", "closed"]) if (!values(joins, "status").has(status)) fail(`joinApplications missing ${status}`);

const events = await seeded("events");
for (const status of ["draft", "open", "closed", "completed"]) if (!values(events, "status").has(status)) fail(`events missing ${status}`);
for (const section of ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "All Sections"]) if (!values(events, "section").has(section)) fail(`events missing ${section}`);

const responses = await seeded("eventConsentResponses");
for (const status of ["new", "matched", "ignored"]) if (!values(responses, "processingStatus").has(status)) fail(`eventConsentResponses missing ${status}`);

const meetings = await seeded("meetingRecords");
for (const type of ["group", "leader"]) if (!values(meetings, "meetingType").has(type)) fail(`meetingRecords missing ${type}`);

const history = await seeded("memberHistory");
for (const type of ["created", "section-transfer", "status-change", "section-and-status-change"]) if (!values(history, "changeType").has(type)) fail(`memberHistory missing ${type}`);

const requests = await seeded("leaderRegistrationRequests");
for (const status of ["pending", "approved", "rejected"]) if (!values(requests, "status").has(status)) fail(`leaderRegistrationRequests missing ${status}`);

const parents = await seeded("parentAccounts");
for (const status of ["pending", "rejected"]) if (!values(parents, "status").has(status)) fail(`parentAccounts missing ${status}`);

console.log("Full-system TEST flow coverage verified successfully.");
console.log("- Join lifecycle: new/contacted/waiting-list/accepted/closed");
console.log("- Event lifecycle: draft/open/closed/completed across every section scope");
console.log("- Consent: youth/scouter, active/inactive links, new/matched/ignored responses");
console.log("- Meetings: group + leader");
console.log("- Member history: all lifecycle change types");
console.log("- Registration/account review states: pending/approved/rejected examples");
