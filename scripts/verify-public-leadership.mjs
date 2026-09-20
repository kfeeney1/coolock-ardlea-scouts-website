import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const PUBLIC_PROJECTION_VERSION = 2;
const GROUP_ROLES = new Set(["group leader","deputy group leader","group chairperson","group secretary","group treasurer","group quartermaster","group quartermaster/bo'sun","group bo'sun","group youth champion"]);
const SECTION_ROLES = new Set(["section leader","assistant section leader","programme scouter","scouter"]);
const YOUTH_SECTIONS = new Set(["beavers","cubs","scouts","ventures","rovers"]);

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function roleKey(value) { return text(value).toLowerCase().replace(/[’‘]/g, "'").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " "); }
function eligibleRole(role, section) {
  const sectionKey = text(section).toLowerCase();
  if (YOUTH_SECTIONS.has(sectionKey)) return SECTION_ROLES.has(roleKey(role));
  return sectionKey === "group" && GROUP_ROLES.has(roleKey(role));
}
function publicAppointmentsFor(source, access) {
  const accountSections = Array.isArray(access?.sections) ? access.sections.map(text).filter(Boolean) : [text(access?.sections || access?.section)].filter(Boolean);
  const raw = Array.isArray(source?.appointments) && source.appointments.length
    ? source.appointments.filter((item) => item && item.active !== false).map((item) => ({ role: text(item.appointment), scope: text(item.scope) }))
    : [{ role: text(source?.scoutingRole), scope: text(source?.organisationSection) }];
  const result = [];
  const seen = new Set();
  for (const item of raw) {
    if (GROUP_ROLES.has(roleKey(item.role))) {
      const key = roleKey(item.role) + "\u0000group";
      if (!seen.has(key)) { seen.add(key); result.push({ role: item.role, section: "Group" }); }
      continue;
    }
    if (!SECTION_ROLES.has(roleKey(item.role))) continue;
    const explicit = [item.scope, text(source?.organisationSection)].filter((section) => YOUTH_SECTIONS.has(text(section).toLowerCase()));
    const candidates = explicit.length ? explicit : accountSections;
    for (const section of candidates) {
      if (!YOUTH_SECTIONS.has(text(section).toLowerCase())) continue;
      const key = roleKey(item.role) + "\u0000" + text(section).toLowerCase();
      if (!seen.has(key)) { seen.add(key); result.push({ role: item.role, section: text(section) }); }
    }
  }
  return result;
}
function sameAppointments(left, right) {
  const normalise = (items) => items.map((item) => `${roleKey(item.role)}@${text(item.section).toLowerCase()}`).sort();
  return JSON.stringify(normalise(left)) === JSON.stringify(normalise(right));
}
function fail(message) { throw new Error(`Public Who's Who verification failed: ${message}`); }

const [adminSnapshot, organisationSnapshot, publicSnapshot] = await Promise.all([
  db.collection("adminUsers").get(),
  db.collection("organisationLeadership").get(),
  db.collection("publicLeadership").get()
]);
const adminByUid = new Map(adminSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const organisationByUid = new Map(organisationSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const publicByUid = new Map(publicSnapshot.docs.map((doc) => [doc.id, doc.data()]));
const expected = new Map();

for (const [uid, source] of organisationByUid) {
  const access = adminByUid.get(uid);
  if (!access || access.active !== true || source.active !== true || source.showPublicly !== true) continue;
  const appointments = publicAppointmentsFor(source, access);
  if (appointments.length === 0) continue;
  expected.set(uid, appointments);
}

for (const [uid, data] of publicByUid) {
  const access = adminByUid.get(uid);
  const source = organisationByUid.get(uid);
  if (!access) fail(`${uid} has no matching adminUsers access profile`);
  if (!source) fail(`${uid} has no matching organisationLeadership record`);
  if (access.active !== true) fail(`${uid} access profile is not explicitly active`);
  if (source.active !== true || source.showPublicly !== true) fail(`${uid} source organisation record is not explicitly active/public`);
  if (data.sourceAccessRole !== "leader") fail(`${uid} is missing sourceAccessRole=leader`);
  if (data.publicProjectionVersion !== PUBLIC_PROJECTION_VERSION) fail(`${uid} has stale projection version ${JSON.stringify(data.publicProjectionVersion)}`);
  const expectedAppointments = expected.get(uid) || [];
  const actualAppointments = Array.isArray(data.publicAppointments) ? data.publicAppointments.filter((item) => item && eligibleRole(item.role, item.section)).map((item) => ({ role: text(item.role), section: text(item.section) })) : [];
  if (!sameAppointments(actualAppointments, expectedAppointments)) fail(`${uid} public appointments do not match the authoritative active appointments`);
  if (text(data.displayName) !== text(source.displayName)) fail(`${uid} displayName does not match authoritative organisation record`);
  if (!expected.has(uid)) fail(`${uid} is not currently eligible for public projection`);
}

for (const uid of expected.keys()) if (!publicByUid.has(uid)) fail(`${uid} is explicitly public and eligible but missing from publicLeadership`);
if (publicByUid.size !== expected.size) fail(`expected ${expected.size} public records, found ${publicByUid.size}`);
console.log(`Public Who's Who verified: ${publicByUid.size} current v${PUBLIC_PROJECTION_VERSION} leader record(s), aligned with active explicit public opt-in and eligible appointments.`);
