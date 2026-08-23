import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const auth = getAuth();

const LEGACY_UID = "TEST_uid_admin_01";
const COLLECTIONS = ["adminUsers", "organisationLeadership", "publicLeadership"];

const deleted = [];
for (const collectionName of COLLECTIONS) {
  const ref = db.collection(collectionName).doc(LEGACY_UID);
  const snapshot = await ref.get();
  if (!snapshot.exists) continue;
  await ref.delete();
  deleted.push(`${collectionName}/${LEGACY_UID}`);
}

try {
  await auth.deleteUser(LEGACY_UID);
  deleted.push(`auth/${LEGACY_UID}`);
} catch (error) {
  if (error?.code !== "auth/user-not-found") throw error;
}

console.log(`Legacy admin fixture cleanup complete. Removed ${deleted.length} record(s).`);
for (const entry of deleted) console.log(`- ${entry}`);
