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
    active: true,
    updatedAt: FieldValue.serverTimestamp()
  };
}

const adminSnapshot = await db.collection("adminUsers").get();
const activeAdminDocs = adminSnapshot.docs.filter((adminDoc) => adminDoc.data().active === true);
let created = 0;
let preserved = 0;
let published = 0;
let unpublished = 0;

for (const adminDoc of activeAdminDocs) {
  const data = adminDoc.data();
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

  const publicRef = db.collection("publicLeadership").doc(adminDoc.id);
  if (record.active !== false && record.showPublicly === true) {
    await publicRef.set(publicPayload(record), { merge: true });
    published += 1;
  } else {
    await publicRef.delete().catch(() => undefined);
    unpublished += 1;
  }
}

const organisationSnapshot = await db.collection("organisationLeadership").get();
const organisationIds = new Set(organisationSnapshot.docs.map((item) => item.id));
const missing = activeAdminDocs.filter((item) => !organisationIds.has(item.id)).map((item) => item.id);

if (missing.length > 0) {
  throw new Error(`Organisation backfill verification failed. Missing active leaders: ${missing.join(", ")}`);
}

console.log(`Organisation backfill complete: ${created} created, ${preserved} existing records preserved, ${published} public records reconciled, ${unpublished} private-only records reconciled, ${activeAdminDocs.length} active leaders verified.`);
