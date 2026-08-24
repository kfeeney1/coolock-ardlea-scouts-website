import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const checkOnly = process.argv.includes("--check");

const CANONICAL_TEST_SEEDS = new Set([
  "comprehensive-population-v3",
  "full-system-flows-v2",
  "playwright-persistence-v1"
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isCanonicalSeedRecord(record) {
  return record?.testData === true
    && CANONICAL_TEST_SEEDS.has(text(record.testSeed))
    && record.createdBySeed === "TEST_SEED";
}

function isApprovedManualRegistration(uid, request) {
  return request
    && text(request.uid || uid) === uid
    && request.status === "approved"
    && request.privacyConfirmed === true
    && Boolean(text(request.reviewedBy));
}

function hasProvenLeadershipSource(uid, source, access, request) {
  if (!source || !access) return false;
  const seeded = isCanonicalSeedRecord(source) && isCanonicalSeedRecord(access);
  const manual = isApprovedManualRegistration(uid, request)
    && source?.testData !== true
    && access?.testData !== true;
  return seeded || manual;
}

const [organisationSnapshot, adminSnapshot, publicSnapshot, registrationSnapshot] = await Promise.all([
  db.collection("organisationLeadership").get(),
  db.collection("adminUsers").get(),
  db.collection("publicLeadership").get(),
  db.collection("leaderRegistrationRequests").get()
]);

const adminByUid = new Map(adminSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const registrationByUid = new Map(registrationSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const publicByUid = new Map(publicSnapshot.docs.map((doc) => [doc.id, doc]));
const ambiguous = [];

for (const organisationDoc of organisationSnapshot.docs) {
  const uid = organisationDoc.id;
  const source = organisationDoc.data();
  const access = adminByUid.get(uid);
  const registration = registrationByUid.get(uid);
  if (hasProvenLeadershipSource(uid, source, access, registration)) continue;

  ambiguous.push({
    uid,
    displayName: text(source.displayName),
    hasAdminProfile: Boolean(access),
    sourceSeed: text(source.testSeed),
    accessSeed: text(access?.testSeed),
    registrationStatus: text(registration?.status)
  });
}

if (checkOnly) {
  if (ambiguous.length) {
    console.log(`Found ${ambiguous.length} leadership record(s) outside canonical seed or approved registration provenance:`);
    for (const item of ambiguous) {
      console.log(`- ${item.uid}${item.displayName ? ` (${item.displayName})` : ""}`);
    }
  } else {
    console.log("No legacy/ambiguous leadership records found.");
  }
  process.exit(0);
}

for (let offset = 0; offset < ambiguous.length; offset += 400) {
  const batch = db.batch();
  for (const item of ambiguous.slice(offset, offset + 400)) {
    batch.delete(db.collection("organisationLeadership").doc(item.uid));
    const publicDoc = publicByUid.get(item.uid);
    if (publicDoc) batch.delete(publicDoc.ref);
  }
  await batch.commit();
}

console.log(`Removed ${ambiguous.length} leadership source record(s) outside canonical seed or approved registration provenance.`);
console.log("Matching publicLeadership projections were removed when present.");
console.log("Firebase Auth users and unrelated collections were not modified.");
