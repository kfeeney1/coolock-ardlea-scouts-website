import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const PUBLIC_PROJECTION_VERSION = 2;

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
const YOUTH_SECTIONS = new Set(["beavers", "cubs", "scouts", "ventures", "rovers"]);

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function roleKey(value) { return text(value).toLowerCase().replace(/[’‘]/g, "'").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " "); }
function isPublicRole(role, section) {
  const sectionKey = text(section).toLowerCase();
  if (YOUTH_SECTIONS.has(sectionKey)) return Boolean(text(role));
  return sectionKey === "group" && GROUP_ROLES.has(roleKey(role));
}
function isPrivileged(role) { return ["admin", "super-admin"].includes(text(role).toLowerCase()); }

const [organisationSnapshot, adminSnapshot, existingPublicSnapshot] = await Promise.all([
  db.collection("organisationLeadership").get(),
  db.collection("adminUsers").get(),
  db.collection("publicLeadership").get()
]);

const adminByUid = new Map(adminSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const desired = new Map();

for (const doc of organisationSnapshot.docs) {
  const source = doc.data();
  const access = adminByUid.get(doc.id);
  if (!access || isPrivileged(access.role)) continue;
  if (text(access.role).toLowerCase() !== "leader") continue;
  if (access.active === false || source.active === false || source.showPublicly !== true) continue;
  if (!isPublicRole(source.scoutingRole, source.organisationSection)) continue;

  const testMarker = source.testData === true
    ? { testData: true, testSeed: source.testSeed || "public-projection-test", createdBySeed: source.createdBySeed || "TEST_SEED" }
    : {};

  desired.set(doc.id, {
    displayName: text(source.displayName),
    scoutingRole: text(source.scoutingRole),
    organisationSection: text(source.organisationSection),
    organisationOrder: typeof source.organisationOrder === "number" ? source.organisationOrder : 999,
    reportsToUid: text(source.reportsToUid),
    showPublicly: true,
    active: true,
    sourceAccessRole: "leader",
    publicProjectionVersion: PUBLIC_PROJECTION_VERSION,
    ...testMarker,
    updatedAt: FieldValue.serverTimestamp()
  });
}

const batch = db.batch();
for (const doc of existingPublicSnapshot.docs) batch.delete(doc.ref);
for (const [uid, record] of desired) batch.set(db.collection("publicLeadership").doc(uid), record);
await batch.commit();

console.log(`Rebuilt publicLeadership from authoritative organisation/admin data.`);
console.log(`Removed ${existingPublicSnapshot.size} existing public record(s).`);
console.log(`Published ${desired.size} eligible leader record(s) with projection v${PUBLIC_PROJECTION_VERSION}.`);
console.log(`Excluded all non-leader, admin and super-admin access identities before publication.`);
