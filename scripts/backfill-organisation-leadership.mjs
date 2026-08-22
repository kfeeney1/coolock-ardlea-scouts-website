import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();

const TEST_ROLE_OVERRIDES = {
  TEST_uid_leader_parent_01: { scoutingRole: "Beaver Section Leader", organisationSection: "Beavers", organisationOrder: 10, reportsToUid: "TEST_uid_admin_01", showPublicly: true },
  TEST_uid_leader_only_01: { scoutingRole: "Scout Section Leader", organisationSection: "Scouts", organisationOrder: 10, reportsToUid: "TEST_uid_admin_01", showPublicly: true },
  TEST_uid_multi_section_leader_01: { scoutingRole: "Assistant Section Leader", organisationSection: "Cubs", organisationOrder: 20, reportsToUid: "TEST_uid_admin_01", showPublicly: false },
  TEST_uid_admin_01: { scoutingRole: "Group Leader", organisationSection: "Group", organisationOrder: 1, reportsToUid: "", showPublicly: true },
  TEST_uid_super_admin_01: { scoutingRole: "Group Council Administrator", organisationSection: "Group", organisationOrder: 20, reportsToUid: "TEST_uid_admin_01", showPublicly: false },
  TEST_uid_shared_super_admin_01: { scoutingRole: "Group Council Administrator", organisationSection: "Group", organisationOrder: 30, reportsToUid: "TEST_uid_admin_01", showPublicly: false }
};

function defaultRole(data) {
  if (data.role === "admin" || data.role === "super-admin") return "Group Leader";
  const section = Array.isArray(data.sections) && data.sections.length ? data.sections[0] : data.section;
  return section && section !== "Group" ? `${section.replace(/s$/, "")} Section Leader` : "Leader";
}

function defaultSection(data) {
  if (Array.isArray(data.sections) && data.sections.length) return data.sections[0];
  return typeof data.section === "string" && data.section ? data.section : "Group";
}

const adminSnapshot = await db.collection("adminUsers").get();
let created = 0;
let preserved = 0;

for (const adminDoc of adminSnapshot.docs) {
  const data = adminDoc.data();
  if (data.active !== true) continue;

  const orgRef = db.collection("organisationLeadership").doc(adminDoc.id);
  const existing = await orgRef.get();
  if (existing.exists) {
    preserved += 1;
    continue;
  }

  const override = TEST_ROLE_OVERRIDES[adminDoc.id];
  const record = {
    displayName: typeof data.displayName === "string" && data.displayName.trim() ? data.displayName.trim() : "Leader",
    scoutingRole: override?.scoutingRole || defaultRole(data),
    organisationSection: override?.organisationSection || defaultSection(data),
    organisationOrder: override?.organisationOrder ?? 999,
    reportsToUid: override?.reportsToUid || "",
    showPublicly: override?.showPublicly === true,
    active: true,
    updatedAt: FieldValue.serverTimestamp()
  };

  await orgRef.set(record);
  created += 1;

  if (record.showPublicly) {
    await db.collection("publicLeadership").doc(adminDoc.id).set({
      displayName: record.displayName,
      scoutingRole: record.scoutingRole,
      organisationSection: record.organisationSection,
      organisationOrder: record.organisationOrder,
      reportsToUid: record.reportsToUid,
      active: true,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
}

console.log(`Organisation backfill complete: ${created} created, ${preserved} existing records preserved.`);
