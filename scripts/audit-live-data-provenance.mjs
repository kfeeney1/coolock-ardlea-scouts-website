import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const CANONICAL_TEST_SEEDS = new Set([
  "comprehensive-population-v3",
  "full-system-flows-v2",
  "playwright-persistence-v1",
  "public-site-content-v1"
]);

const EXPECTED_COLLECTIONS = new Set([
  "adminUsers",
  "parentAccounts",
  "leaderRegistrationRequests",
  "joinApplications",
  "members",
  "memberHistory",
  "events",
  "publicEvents",
  "eventConsentLinks",
  "eventConsentResponses",
  "consentApplications",
  "meetingRecords",
  "weeklyMeetings",
  "organisationLeadership",
  "publicLeadership",
  "publicSiteContent",
  "auditLog"
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sameText(a, b) {
  return text(a) === text(b);
}

function hasAnyTestMarker(data) {
  return data.testData !== undefined || data.testSeed !== undefined || data.createdBySeed !== undefined;
}

function validSeedMarker(data) {
  return data.testData === true
    && CANONICAL_TEST_SEEDS.has(text(data.testSeed))
    && data.createdBySeed === "TEST_SEED";
}

const errors = [];
const counts = new Map();
const docsByCollection = new Map();

function fail(collection, id, message) {
  errors.push(`${collection}/${id}: ${message}`);
}

const roots = await db.listCollections();
for (const collectionRef of roots) {
  if (!EXPECTED_COLLECTIONS.has(collectionRef.id)) {
    errors.push(`Unexpected root collection: ${collectionRef.id}`);
  }
}

for (const collectionName of EXPECTED_COLLECTIONS) {
  const snapshot = await db.collection(collectionName).get();
  counts.set(collectionName, snapshot.size);
  docsByCollection.set(collectionName, new Map(snapshot.docs.map((doc) => [doc.id, doc.data()])));

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (hasAnyTestMarker(data) && !validSeedMarker(data)) {
      fail(collectionName, doc.id, `invalid/non-canonical test provenance marker (${JSON.stringify(data.testSeed)})`);
    }
    if (doc.id.startsWith("TEST_") && !validSeedMarker(data)) {
      fail(collectionName, doc.id, "TEST_ document is not marked as canonical seeded test data");
    }
    if (!doc.id.startsWith("TEST_") && data.testData === true) {
      fail(collectionName, doc.id, "seeded test document must use a TEST_ document id");
    }
  }
}

const get = (collection, id) => docsByCollection.get(collection)?.get(id);

const siteDocs = docsByCollection.get("publicSiteContent");
if (siteDocs.size !== 1 || !siteDocs.has("TEST_site")) {
  errors.push("publicSiteContent must contain exactly the canonical TEST_site document");
} else {
  const site = siteDocs.get("TEST_site");
  if (site.contentVersion !== 1 || site.testSeed !== "public-site-content-v1") {
    fail("publicSiteContent", "TEST_site", "contentVersion/testSeed does not match canonical public content contract");
  }
}

for (const [id, data] of docsByCollection.get("members")) {
  if (!new Set(["manual", "join-application"]).has(data.source)) {
    fail("members", id, `source must be manual or join-application, found ${JSON.stringify(data.source)}`);
  }
  if (data.source === "join-application") {
    const sourceId = text(data.sourceJoinApplicationId);
    if (!sourceId || !get("joinApplications", sourceId)) {
      fail("members", id, "join-application member has no valid sourceJoinApplicationId");
    }
  }
}

for (const [id, data] of docsByCollection.get("joinApplications")) {
  if (data.source !== "website") fail("joinApplications", id, `source must be website, found ${JSON.stringify(data.source)}`);
}

for (const [id, data] of docsByCollection.get("consentApplications")) {
  if (data.source !== "website") fail("consentApplications", id, `source must be website, found ${JSON.stringify(data.source)}`);
}

for (const [id, data] of docsByCollection.get("publicLeadership")) {
  const organisation = get("organisationLeadership", id);
  const access = get("adminUsers", id);
  if (!organisation) {
    fail("publicLeadership", id, "has no organisationLeadership source");
    continue;
  }
  if (!access || access.role !== "leader" || access.active !== true) {
    fail("publicLeadership", id, "has no active leader adminUsers source");
    continue;
  }
  for (const field of ["displayName", "scoutingRole", "organisationSection", "reportsToUid"]) {
    if (!sameText(data[field], organisation[field])) fail("publicLeadership", id, `${field} differs from organisationLeadership source`);
  }
  if (data.organisationOrder !== organisation.organisationOrder) fail("publicLeadership", id, "organisationOrder differs from source");
  if (organisation.showPublicly !== true || organisation.active !== true) fail("publicLeadership", id, "source organisation record is not active/public");
  if (organisation.testData === true && data.testSeed !== organisation.testSeed) fail("publicLeadership", id, "seed provenance differs from source organisation record");
}

for (const [id, data] of docsByCollection.get("publicEvents")) {
  const sourceId = text(data.eventId) || id;
  const event = get("events", sourceId);
  if (!event) {
    fail("publicEvents", id, `has no source event ${sourceId}`);
    continue;
  }
  if (event.status !== "open") fail("publicEvents", id, `source event is ${JSON.stringify(event.status)}, not open`);
  for (const field of ["title", "description", "eventType", "section", "location", "startDate", "endDate"]) {
    if (!sameText(data[field], event[field])) fail("publicEvents", id, `${field} differs from source event`);
  }
}

for (const [id, data] of docsByCollection.get("eventConsentLinks")) {
  const eventId = text(data.eventId);
  if (!eventId || !get("events", eventId)) fail("eventConsentLinks", id, `has no source event ${eventId || "<missing>"}`);
}

for (const [id, data] of docsByCollection.get("eventConsentResponses")) {
  const token = text(data.token);
  const eventId = text(data.eventId);
  const link = get("eventConsentLinks", token);
  if (!link) fail("eventConsentResponses", id, `has no source event consent link ${token || "<missing>"}`);
  else if (text(link.eventId) !== eventId) fail("eventConsentResponses", id, "eventId differs from source consent link");
}

for (const [id, data] of docsByCollection.get("memberHistory")) {
  const memberId = text(data.memberId);
  if (!memberId || !get("members", memberId)) fail("memberHistory", id, `has no source member ${memberId || "<missing>"}`);
}

for (const [id, data] of docsByCollection.get("auditLog")) {
  const actorUid = text(data.actorUid);
  if (!actorUid || !get("adminUsers", actorUid)) fail("auditLog", id, `has no source actor ${actorUid || "<missing>"}`);
}

for (const [id, data] of docsByCollection.get("parentAccounts")) {
  if (text(data.uid) !== id) fail("parentAccounts", id, "uid must match document id");
  if (Array.isArray(data.memberIds)) {
    for (const memberId of data.memberIds) {
      if (!get("members", memberId)) fail("parentAccounts", id, `references missing member ${memberId}`);
    }
  }
}

for (const [id, data] of docsByCollection.get("organisationLeadership")) {
  if (!get("adminUsers", id)) fail("organisationLeadership", id, "has no adminUsers identity source");
  if (data.testData === true && get("adminUsers", id)?.testSeed !== data.testSeed) fail("organisationLeadership", id, "seed provenance differs from adminUsers source");
}

console.log("Live Firestore provenance summary:");
for (const [collection, count] of [...counts.entries()].sort()) console.log(`- ${collection}: ${count}`);

if (errors.length) {
  console.error(`Live data provenance audit failed with ${errors.length} issue(s):`);
  for (const error of errors.sort()) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Live data provenance audit passed: every stored document is canonical seeded test data, direct manual/user input, or a traceable projection/history record derived from those database records.");
