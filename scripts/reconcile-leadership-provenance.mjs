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

function hasNoSeedMarker(record) {
  return record?.testData !== true
    && record?.testSeed === undefined
    && record?.createdBySeed === undefined;
}

function isCanonicalSeedRecord(record) {
  return record?.testData === true
    && CANONICAL_TEST_SEEDS.has(text(record.testSeed))
    && record.createdBySeed === "TEST_SEED";
}

function hasManualAccessProvenance(access) {
  if (!hasNoSeedMarker(access)) return false;
  return Boolean(text(access.approvedBy) || text(access.updatedBy));
}

function hasProvenLeadershipSource(source, access) {
  if (!source || !access) return false;
  const seeded = isCanonicalSeedRecord(source) && isCanonicalSeedRecord(access);
  const manual = hasNoSeedMarker(source) && hasManualAccessProvenance(access);
  return seeded || manual;
}

const [organisationSnapshot, adminSnapshot, publicSnapshot] = await Promise.all([
  db.collection("organisationLeadership").get(),
  db.collection("adminUsers").get(),
  db.collection("publicLeadership").get()
]);

const adminByUid = new Map(adminSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const publicByUid = new Map(publicSnapshot.docs.map((doc) => [doc.id, doc]));
const ambiguous = [];

for (const organisationDoc of organisationSnapshot.docs) {
  const uid = organisationDoc.id;
  const source = organisationDoc.data();
  const access = adminByUid.get(uid);
  if (hasProvenLeadershipSource(source, access)) continue;

  ambiguous.push({
    uid,
    displayName: text(source.displayName),
    hasAdminProfile: Boolean(access),
    sourceSeed: text(source.testSeed),
    accessSeed: text(access?.testSeed)
  });
}

if (checkOnly) {
  if (ambiguous.length) {
    console.log(`Found ${ambiguous.length} unprovenanced leadership record(s):`);
    for (const item of ambiguous) {
      console.log(`- ${item.uid}${item.displayName ? ` (${item.displayName})` : ""}`);
    }
  } else {
    console.log("No unprovenanced leadership records found.");
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

console.log(`Removed ${ambiguous.length} unprovenanced leadership source record(s) from organisationLeadership.`);
console.log("Matching publicLeadership projections were removed when present.");
console.log("Firebase Auth users and unrelated collections were not modified.");
