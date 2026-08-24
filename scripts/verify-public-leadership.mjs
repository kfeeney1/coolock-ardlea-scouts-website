import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
function eligibleRole(role, section) {
  const sectionKey = text(section).toLowerCase();
  if (YOUTH_SECTIONS.has(sectionKey)) return SECTION_ROLES.has(roleKey(role));
  return sectionKey === "group" && GROUP_ROLES.has(roleKey(role));
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
function hasPublishableProvenance(uid, source, access, registration) {
  return (isCanonicalSeedRecord(source) && isCanonicalSeedRecord(access))
    || (isApprovedManualRegistration(uid, registration) && source?.testData !== true && access?.testData !== true);
}
function fail(message) { throw new Error(`Public Who's Who verification failed: ${message}`); }

const [adminSnapshot, organisationSnapshot, publicSnapshot, registrationSnapshot] = await Promise.all([
  db.collection("adminUsers").get(),
  db.collection("organisationLeadership").get(),
  db.collection("publicLeadership").get(),
  db.collection("leaderRegistrationRequests").get()
]);

const adminByUid = new Map(adminSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const organisationByUid = new Map(organisationSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const publicByUid = new Map(publicSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const registrationByUid = new Map(registrationSnapshot.docs.map((doc) => [doc.id, doc.data()]));

for (const [uid, data] of publicByUid) {
  const access = adminByUid.get(uid);
  const source = organisationByUid.get(uid);
  const registration = registrationByUid.get(uid);
  if (!access) fail(`${uid} has no matching adminUsers access profile`);
  if (!source) fail(`${uid} has no matching organisationLeadership record`);
  if (text(access.role).toLowerCase() !== "leader") fail(`${uid} has non-leader access role ${JSON.stringify(access.role)}`);
  if (access.active !== true) fail(`${uid} access profile is not explicitly active`);
  if (source.active !== true || source.showPublicly !== true) fail(`${uid} source organisation record is not explicitly active/public`);
  if (!hasPublishableProvenance(uid, source, access, registration)) fail(`${uid} is neither current canonical seed data nor backed by an approved leader registration`);
  if (data.sourceAccessRole !== "leader") fail(`${uid} is missing sourceAccessRole=leader`);
  if (data.publicProjectionVersion !== PUBLIC_PROJECTION_VERSION) fail(`${uid} has stale projection version ${JSON.stringify(data.publicProjectionVersion)}`);
  if (!eligibleRole(data.scoutingRole, data.organisationSection)) fail(`${uid} has ineligible public appointment ${JSON.stringify(data.organisationSection)} / ${JSON.stringify(data.scoutingRole)}`);
  if (text(data.displayName) !== text(source.displayName)) fail(`${uid} displayName does not match authoritative organisation record`);
  if (text(data.scoutingRole) !== text(source.scoutingRole)) fail(`${uid} scoutingRole does not match authoritative organisation record`);
  if (text(data.organisationSection) !== text(source.organisationSection)) fail(`${uid} organisationSection does not match authoritative organisation record`);
}

const expected = [];
for (const [uid, source] of organisationByUid) {
  const access = adminByUid.get(uid);
  const registration = registrationByUid.get(uid);
  if (!access || text(access.role).toLowerCase() !== "leader") continue;
  if (access.active !== true || source.active !== true || source.showPublicly !== true) continue;
  if (!eligibleRole(source.scoutingRole, source.organisationSection)) continue;
  if (!hasPublishableProvenance(uid, source, access, registration)) continue;
  expected.push(uid);
  if (!publicByUid.has(uid)) fail(`${uid} is eligible and proven but missing from publicLeadership`);
}

if (publicByUid.size !== expected.length) fail(`expected ${expected.length} public records, found ${publicByUid.size}`);

console.log(`Public Who's Who verified: ${publicByUid.size} current v${PUBLIC_PROJECTION_VERSION} leader record(s), all from canonical seed or approved registration provenance.`);
