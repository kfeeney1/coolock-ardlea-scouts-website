import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const auth = getAuth();
const db = getFirestore();

const uid = "TEST_uid_super_admin_01";
const email = "superadmin@example.com";
const password = "password1";
const displayName = "Test Website Super Admin";
const marker = { testData: true, testSeed: "comprehensive-population-v3", createdBySeed: "TEST_SEED" };

const authProperties = {
  email,
  password,
  displayName,
  disabled: false,
  emailVerified: true
};

try {
  await auth.getUser(uid);
  await auth.updateUser(uid, authProperties);
} catch (error) {
  if (error?.code !== "auth/user-not-found") throw error;
  await auth.createUser({ uid, ...authProperties });
}

await db.collection("adminUsers").doc(uid).set({
  uid,
  email,
  displayName,
  role: "super-admin",
  sections: ["Group"],
  active: true,
  mobileNumber: "0872000000",
  testRoleType: "super-admin",
  ...marker,
  updatedAt: FieldValue.serverTimestamp()
}, { merge: true });

await db.collection("organisationLeadership").doc(uid).set({
  displayName,
  scoutingRole: "Group Council Administrator",
  organisationSection: "Group",
  organisationOrder: 91,
  reportsToUid: "TEST_uid_group_leader",
  showPublicly: false,
  active: true,
  testRoleType: "super-admin",
  ...marker,
  updatedAt: FieldValue.serverTimestamp()
}, { merge: true });

await db.collection("publicLeadership").doc(uid).delete().catch(() => {});

console.log(`Canonical super-admin login seeded: ${email}`);
