import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

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
function eligibleRole(role, section) {
  const sectionKey = text(section).toLowerCase();
  if (YOUTH_SECTIONS.has(sectionKey)) return Boolean(text(role));
  return sectionKey === "group" && GROUP_ROLES.has(roleKey(role));
}
function privileged(role) { return ["admin", "super-admin"].includes(text(role).toLowerCase()); }
function fail(message) { throw new Error(`Public Who's Who verification failed: ${message}`); }

const [adminSnapshot, organisationSnapshot, publicSnapshot] = await Promise.all([
  db.collection("adminUsers").get(),
  db.collection("organisationLeadership").get(),
  db.collection("publicLeadership").get()
]);

const adminByUid = new Map(adminSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const organisationByUid = new Map(organisationSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const publicByUid = new Map(publicSnapshot.docs.map((doc) => [doc.id, doc.data()]));

for (const [uid, data] of publicByUid) {
  const access = adminByUid.get(uid);
  const source = organisationByUid.get(uid);
  if (!access) fail(`${uid} has no matching adminUsers access profile`);
  if (!source) fail(`${uid} has no matching organisationLeadership record`);
  if (privileged(access.role)) fail(`${uid} has privileged access role ${JSON.stringify(access.role)}`);
  if (access.active === false) fail(`${uid} access profile is inactive`);
  if (source.active === false || source.showPublicly !== true) fail(`${uid} source organisation record is not active/public`);
  if (!eligibleRole(data.scoutingRole, data.organisationSection)) fail(`${uid} has ineligible public appointment ${JSON.stringify(data.organisationSection)} / ${JSON.stringify(data.scoutingRole)}`);
  if (text(data.displayName) !== text(source.displayName)) fail(`${uid} displayName does not match authoritative organisation record`);
  if (text(data.scoutingRole) !== text(source.scoutingRole)) fail(`${uid} scoutingRole does not match authoritative organisation record`);
  if (text(data.organisationSection) !== text(source.organisationSection)) fail(`${uid} organisationSection does not match authoritative organisation record`);
}

const expected = [];
for (const [uid, source] of organisationByUid) {
  const access = adminByUid.get(uid);
  if (!access || privileged(access.role)) continue;
  if (access.active === false || source.active === false || source.showPublicly !== true) continue;
  if (!eligibleRole(source.scoutingRole, source.organisationSection)) continue;
  expected.push(uid);
  if (!publicByUid.has(uid)) fail(`${uid} is eligible but missing from publicLeadership`);
}

if (publicByUid.size !== expected.length) fail(`expected ${expected.length} public records, found ${publicByUid.size}`);

console.log(`Public Who's Who verified: ${publicByUid.size} eligible leader record(s), zero admin/super-admin identities.`);
