import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const optInAllActiveLeaders = String(process.env.OPT_IN_ALL_ACTIVE_LEADERS || "").toLowerCase() === "true";
const PUBLIC_PROJECTION_VERSION = 2;
const WEB_ADMIN_UID = "TEST_uid_web_admin_01";

const PUBLIC_GROUP_ROLES = new Set([
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

const TEST_ROLE_OVERRIDES = {
  TEST_uid_leader_parent_01: { scoutingRole: "Beaver Programme Scouter", organisationSection: "Beavers", organisationOrder: 10, reportsToUid: WEB_ADMIN_UID, showPublicly: true },
  TEST_uid_leader_only_01: { scoutingRole: "Scout Programme Scouter", organisationSection: "Scouts", organisationOrder: 10, reportsToUid: WEB_ADMIN_UID, showPublicly: true },
  TEST_uid_multi_section_leader_01: { scoutingRole: "Assistant Section Leader", organisationSection: "Cubs", organisationOrder: 20, reportsToUid: WEB_ADMIN_UID, showPublicly: false },
  [WEB_ADMIN_UID]: { scoutingRole: "Group Council Administrator", organisationSection: "Group", organisationOrder: 90, reportsToUid: "TEST_uid_group_leader", showPublicly: false },
  TEST_uid_super_admin_01: { scoutingRole: "Group Council Administrator", organisationSection: "Group", organisationOrder: 91, reportsToUid: "TEST_uid_group_leader", showPublicly: false },
  TEST_uid_shared_super_admin_01: { scoutingRole: "Group Council Administrator", organisationSection: "Group", organisationOrder: 92, reportsToUid: "TEST_uid_group_leader", showPublicly: false }
};

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function roleKey(role) {
  return text(role).toLowerCase().replace(/[’‘]/g, "'").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
}
function isPublicRole(role, section) {
  const sectionKey = text(section).toLowerCase();
  if (YOUTH_SECTIONS.has(sectionKey)) return Boolean(text(role));
  return sectionKey === "group" && PUBLIC_GROUP_ROLES.has(roleKey(role));
}
function isLeaderAccessRole(role) { return roleKey(role) === "leader"; }

function defaultSection(data) {
  if (Array.isArray(data.sections) && data.sections.length) return data.sections[0];
  return typeof data.section === "string" && data.section ? data.section : "Group";
}

function publicPayload(record) {
  return {
    displayName: record.displayName,
    scoutingRole: record.scoutingRole,
    organisationSection: record.organisationSection,
    organisationOrder: record.organisationOrder,
    reportsToUid: record.reportsToUid,
    showPublicly: true,
    active: true,
    publicProjectionVersion: PUBLIC_PROJECTION_VERSION,
    sourceAccessRole: "leader",
    updatedAt: FieldValue.serverTimestamp()
  };
}

const adminSnapshot = await db.collection("adminUsers").get();
const activeAdminDocs = adminSnapshot.docs.filter((adminDoc) => adminDoc.data().active === true);
let created = 0;
let preserved = 0;
let optedIn = 0;
let published = 0;
let unpublished = 0;
let privilegedExcluded = 0;
let eligibleForOptIn = 0;

for (const adminDoc of activeAdminDocs) {
  const data = adminDoc.data();
  const leaderAccess = isLeaderAccessRole(data.role);
  const orgRef = db.collection("organisationLeadership").doc(adminDoc.id);
  const existing = await orgRef.get();
  let record;

  if (existing.exists) {
    preserved += 1;
    record = existing.data();
  } else {
    const override = TEST_ROLE_OVERRIDES[adminDoc.id];
    record = {
      displayName: typeof data.displayName === "string" && data.displayName.trim() ? data.displayName.trim() : "Leader",
      scoutingRole: override?.scoutingRole || "Leader",
      organisationSection: override?.organisationSection || defaultSection(data),
      organisationOrder: override?.organisationOrder ?? 999,
      reportsToUid: override?.reportsToUid || "",
      showPublicly: override?.showPublicly === true,
      active: true,
      updatedAt: FieldValue.serverTimestamp()
    };
    await orgRef.set(record);
    created += 1;
  }

  const eligible = leaderAccess && isPublicRole(record.scoutingRole, record.organisationSection);
  if (eligible) eligibleForOptIn += 1;

  if (!leaderAccess && record.showPublicly === true) {
    record = { ...record, showPublicly: false, active: true, updatedAt: FieldValue.serverTimestamp() };
    await orgRef.set({ showPublicly: false, active: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  } else if (optInAllActiveLeaders && eligible && record.showPublicly !== true) {
    record = { ...record, showPublicly: true, active: true, updatedAt: FieldValue.serverTimestamp() };
    await orgRef.set({ showPublicly: true, active: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    optedIn += 1;
  }

  const publicRef = db.collection("publicLeadership").doc(adminDoc.id);
  if (record.active !== false && record.showPublicly === true && eligible) {
    await publicRef.set(publicPayload(record));
    published += 1;
  } else {
    await publicRef.delete().catch(() => undefined);
    unpublished += 1;
    if (!leaderAccess) privilegedExcluded += 1;
  }
}

const organisationSnapshot = await db.collection("organisationLeadership").get();
const organisationIds = new Set(organisationSnapshot.docs.map((item) => item.id));
const missing = activeAdminDocs.filter((item) => !organisationIds.has(item.id)).map((item) => item.id);

if (missing.length > 0) {
  throw new Error(`Organisation backfill verification failed. Missing active leaders: ${missing.join(", ")}`);
}

if (optInAllActiveLeaders && published !== eligibleForOptIn) {
  throw new Error(`Organisation opt-in migration failed. Expected ${eligibleForOptIn} eligible public leaders but reconciled ${published}.`);
}

console.log(`Organisation backfill complete: ${created} created, ${preserved} existing records preserved, ${optedIn} eligible leader(s) opted in, ${published} public records reconciled, ${unpublished} private-only records reconciled, ${privilegedExcluded} non-leader access account(s) excluded, ${activeAdminDocs.length} active access profiles verified.`);
