import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const PUBLIC_PROJECTION_VERSION = 2;
const CANONICAL_TEST_SEEDS = new Set(["comprehensive-population-v3", "full-system-flows-v2", "playwright-persistence-v1"]);

const GROUP_ROLES = new Set([
  "group leader",
  "group chairperson",
  "group secretary",
  "group treasurer",
  "group quartermaster",
  "group quartermaster/bo'sun",
  "group bo'sun",
  "group youth champion"
]);
const SECTION_ROLES = new Set(["section leader", "assistant section leader", "programme scouter", "scouter"]);
const YOUTH_SECTIONS = new Set(["beavers", "cubs", "scouts", "ventures", "rovers"]);

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function roleKey(value) { return text(value).toLowerCase().replace(/[’‘]/g, "'").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " "); }
function isPublicRole(role, section) {
  const sectionKey = text(section).toLowerCase();
  if (YOUTH_SECTIONS.has(sectionKey)) return SECTION_ROLES.has(roleKey(role));
  return sectionKey === "group" && GROUP_ROLES.has(roleKey(role));
}
function hasNoSeedMarker(record) {
  return record?.testData !== true && record?.testSeed === undefined && record?.createdBySeed === undefined;
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
function hasPublishableProvenance(source, access) {
  const seeded = isCanonicalSeedRecord(source) && isCanonicalSeedRecord(access);
  const manual = hasNoSeedMarker(source) && hasManualAccessProvenance(access);
  return seeded || manual;
}

const [organisationSnapshot, adminSnapshot, existingPublicSnapshot] = await Promise.all([
  db.collection("organisationLeadership").get(),
  db.collection("adminUsers").get(),
  db.collection("publicLeadership").get()
]);

const adminByUid = new Map(adminSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const desired = new Map();
const excludedUnprovenanced = [];
const rejected = [];

for (const doc of organisationSnapshot.docs) {
  const source = doc.data();
  const access = adminByUid.get(doc.id);
  if (!access || text(access.role).toLowerCase() !== "leader" || access.active !== true) continue;
  if (source.active !== true || source.showPublicly !== true) continue;
  if (!isPublicRole(source.scoutingRole, source.organisationSection)) continue;

  if (!text(source.displayName) || !text(source.scoutingRole) || !text(source.organisationSection)) {
    rejected.push(`${doc.id}: missing required public organisation fields`);
    continue;
  }
  if (typeof source.organisationOrder !== "number" || !Number.isFinite(source.organisationOrder)) {
    rejected.push(`${doc.id}: invalid organisationOrder`);
    continue;
  }
  if (!hasPublishableProvenance(source, access)) {
    excludedUnprovenanced.push(doc.id);
    continue;
  }

  const testMarker = source.testData === true
    ? { testData: true, testSeed: source.testSeed, createdBySeed: "TEST_SEED" }
    : {};

  desired.set(doc.id, {
    displayName: text(source.displayName),
    scoutingRole: text(source.scoutingRole),
    organisationSection: text(source.organisationSection),
    organisationOrder: source.organisationOrder,
    reportsToUid: text(source.reportsToUid),
    showPublicly: true,
    active: true,
    sourceAccessRole: "leader",
    publicProjectionVersion: PUBLIC_PROJECTION_VERSION,
    ...testMarker,
    updatedAt: FieldValue.serverTimestamp()
  });
}

if (rejected.length) {
  throw new Error(`Refusing to rebuild publicLeadership from malformed canonical/proven records:\n${rejected.join("\n")}`);
}

const batch = db.batch();
for (const doc of existingPublicSnapshot.docs) batch.delete(doc.ref);
for (const [uid, record] of desired) batch.set(db.collection("publicLeadership").doc(uid), record);
await batch.commit();

console.log("Rebuilt publicLeadership only from proven canonical seed or explicit manual/admin data.");
console.log(`Removed ${existingPublicSnapshot.size} existing public record(s).`);
console.log(`Published ${desired.size} eligible leader record(s) with projection v${PUBLIC_PROJECTION_VERSION}.`);
if (excludedUnprovenanced.length) {
  console.log(`Excluded ${excludedUnprovenanced.length} unprovenanced legacy/ambiguous source record(s): ${excludedUnprovenanced.join(", ")}`);
}
