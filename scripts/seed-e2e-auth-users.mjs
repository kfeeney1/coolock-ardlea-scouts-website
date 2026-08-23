import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const password = process.env.E2E_TEST_USER_PASSWORD;
const action = process.argv[2] || "seed";

if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
if (!["seed", "cleanup"].includes(action)) throw new Error("Usage: node scripts/seed-e2e-auth-users.mjs seed|cleanup");
if (action === "seed" && (!password || password.length < 8)) throw new Error("E2E_TEST_USER_PASSWORD must be configured and contain at least 8 characters.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const auth = getAuth();
const db = getFirestore();

const users = [
  { uid: "TEST_uid_parent_only_01", email: "test.parent.only@example.com", displayName: "Mark Byrne", kind: "parent-only", parent: { linkedSections: ["Cubs"] } },
  { uid: "TEST_uid_leader_parent_01", email: "test.leader.parent@example.com", displayName: "Niamh Murphy", kind: "parent-leader", parent: { linkedSections: ["Beavers"] }, admin: { role: "leader", sections: ["Beavers"], scoutingRole: "Beaver Programme Scouter", organisationSection: "Beavers", organisationOrder: 10, reportsToUid: "TEST_uid_admin_01", showPublicly: true } },
  { uid: "TEST_uid_leader_only_01", email: "test.leader.only@example.com", displayName: "Aisling Ryan", kind: "leader", admin: { role: "leader", sections: ["Scouts"], scoutingRole: "Scout Programme Scouter", organisationSection: "Scouts", organisationOrder: 10, reportsToUid: "TEST_uid_admin_01", showPublicly: true } },
  { uid: "TEST_uid_multi_section_leader_01", email: "test.leader.multisection@example.com", displayName: "Conor Walsh", kind: "multi-section-leader", admin: { role: "leader", sections: ["Beavers", "Cubs"], scoutingRole: "Assistant Section Leader", organisationSection: "Cubs", organisationOrder: 20, reportsToUid: "TEST_uid_admin_01", showPublicly: true } },
  { uid: "TEST_uid_admin_01", email: "test.admin@example.com", displayName: "Orla Kelly", kind: "admin", admin: { role: "admin", sections: ["Group"], scoutingRole: "Group Leader", organisationSection: "Group", organisationOrder: 1, reportsToUid: "", showPublicly: false } },
  { uid: "TEST_uid_super_admin_01", email: "test.superadmin@example.com", displayName: "Test Super Admin", kind: "super-admin", admin: { role: "super-admin", sections: ["Group"], scoutingRole: "Group Council Administrator", organisationSection: "Group", organisationOrder: 20, reportsToUid: "TEST_uid_admin_01", showPublicly: false } },
  { uid: "TEST_uid_shared_super_admin_01", email: "superadmin@example.com", displayName: "Shared Tester Super Admin", kind: "shared-super-admin", password: "password1", admin: { role: "super-admin", sections: ["Group"], scoutingRole: "Group Council Administrator", organisationSection: "Group", organisationOrder: 30, reportsToUid: "TEST_uid_admin_01", showPublicly: false } },
  { uid: "TEST_uid_pending_leader_01", email: "test.leader.pending@example.com", displayName: "Patrick Doyle", kind: "pending-leader" }
];

const cubConsentLink = { token: "TESTTOKENCUBCAMP2026", eventId: "TEST_event_cub_camp", title: "TEST Cub Weekend Camp", description: "Demo overnight camp with mixed consent states.", eventType: "Camp", section: "Cubs", location: "Larch Hill", meetingPoint: "Scout Den Friday 18:00", returnDetails: "Scout Den Sunday 14:00", startDate: "2026-10-02", endDate: "2026-10-04", consentRequired: true, active: true };
const pendingLeader = users.find((user) => user.kind === "pending-leader");

async function upsertAuthUser(user) {
  const userPassword = user.password || password;
  try {
    const existing = await auth.getUser(user.uid);
    if (existing.email !== user.email) throw new Error(`UID ${user.uid} already exists with unexpected email ${existing.email}.`);
    await auth.updateUser(user.uid, { email: user.email, password: userPassword, displayName: user.displayName, disabled: false, emailVerified: true });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    await auth.createUser({ uid: user.uid, email: user.email, password: userPassword, displayName: user.displayName, disabled: false, emailVerified: true });
  }
}

async function seedAdminProfile(user) {
  if (!user.admin) return;
  await db.collection("adminUsers").doc(user.uid).set({ uid: user.uid, email: user.email, displayName: user.displayName, role: user.admin.role, sections: user.admin.sections, section: user.admin.sections[0] || "", active: true, testData: true, testSeed: "stage8-role-demo", createdBySeed: "TEST_SEED", testRoleType: user.kind, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const organisationRecord = {
    displayName: user.displayName,
    scoutingRole: user.admin.scoutingRole,
    organisationSection: user.admin.organisationSection,
    organisationOrder: user.admin.organisationOrder,
    reportsToUid: user.admin.reportsToUid,
    showPublicly: user.admin.showPublicly,
    active: true,
    testData: true,
    testSeed: "stage8-role-demo",
    createdBySeed: "TEST_SEED",
    updatedAt: FieldValue.serverTimestamp()
  };
  await db.collection("organisationLeadership").doc(user.uid).set(organisationRecord, { merge: true });
  if (user.admin.showPublicly) {
    await db.collection("publicLeadership").doc(user.uid).set(organisationRecord, { merge: true });
  } else {
    await db.collection("publicLeadership").doc(user.uid).delete().catch(() => {});
  }
}

async function seedParentProfile(user) {
  if (!user.parent) return;
  await db.collection("parentAccounts").doc(user.uid).set({ linkedSections: user.parent.linkedSections, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

async function seedPendingLeaderRequest() {
  if (!pendingLeader) return;
  await db.collection("leaderRegistrationRequests").doc(pendingLeader.uid).set({ uid: pendingLeader.uid, fullName: pendingLeader.displayName, email: pendingLeader.email, mobileNumber: "0872000090", requestedRole: "Programme Scouter", requestedSection: "Cubs", reason: "TEST DATA ONLY. Pending leader journey request.", privacyConfirmed: true, status: "pending", submittedAt: FieldValue.serverTimestamp(), reviewedAt: null, reviewedBy: "", reviewNote: "", testData: true, testSeed: "stage8-role-demo", createdBySeed: "TEST_SEED" }, { merge: true });
}

async function seedCubConsentLink() {
  await db.collection("eventConsentLinks").doc(cubConsentLink.token).set({ ...cubConsentLink, testData: true, testSeed: "stage8-role-demo", createdBySeed: "TEST_SEED", createdBy: "TEST_SEED", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

async function seed() {
  for (const user of users) { await upsertAuthUser(user); await seedAdminProfile(user); await seedParentProfile(user); }
  await seedPendingLeaderRequest();
  await seedCubConsentLink();
  console.log("E2E seed complete: parent, leader, admin, super-admin, shared tester super-admin and pending-leader journey accounts are ready.");
  console.log("Public E2E roles use Programme Scouter titles; Assistant Section Leader remains a deliberate rejected legacy fixture.");
}

async function deleteTestDoc(collectionName, id) {
  const ref = db.collection(collectionName).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return;
  if (snapshot.data()?.testData !== true) throw new Error(`Refusing to delete ${collectionName}/${id}: testData marker is missing.`);
  await ref.delete();
}

async function cleanup() {
  for (const user of users) {
    try { await auth.deleteUser(user.uid); } catch (error) { if (error?.code !== "auth/user-not-found") throw error; }
    if (user.admin) {
      if (["multi-section-leader", "admin", "super-admin", "shared-super-admin"].includes(user.kind)) await deleteTestDoc("adminUsers", user.uid);
      await deleteTestDoc("organisationLeadership", user.uid);
      await deleteTestDoc("publicLeadership", user.uid);
    }
  }
  if (pendingLeader) await deleteTestDoc("leaderRegistrationRequests", pendingLeader.uid);
  await deleteTestDoc("eventConsentLinks", cubConsentLink.token);
  console.log("E2E Auth cleanup complete.");
}

if (action === "seed") await seed(); else await cleanup();
