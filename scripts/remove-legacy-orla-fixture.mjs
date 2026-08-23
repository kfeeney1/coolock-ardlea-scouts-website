import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const auth = getAuth();

const LEGACY_UID = "TEST_uid_admin_01";
const LEGACY_DISPLAY_NAME = "Orla Kelly";
const COLLECTIONS = ["adminUsers", "organisationLeadership", "publicLeadership"];

const deleted = [];

for (const collectionName of COLLECTIONS) {
  const collection = db.collection(collectionName);

  const legacyUidRef = collection.doc(LEGACY_UID);
  const legacyUidSnapshot = await legacyUidRef.get();
  if (legacyUidSnapshot.exists) {
    await legacyUidRef.delete();
    deleted.push(`${collectionName}/${LEGACY_UID}`);
  }

  const namedSnapshot = await collection.where("displayName", "==", LEGACY_DISPLAY_NAME).get();
  for (const doc of namedSnapshot.docs) {
    await doc.ref.delete();
    deleted.push(`${collectionName}/${doc.id}`);
  }
}

try {
  await auth.deleteUser(LEGACY_UID);
  deleted.push(`auth/${LEGACY_UID}`);
} catch (error) {
  if (error?.code !== "auth/user-not-found") throw error;
}

let nextPageToken;
do {
  const page = await auth.listUsers(1000, nextPageToken);
  for (const user of page.users) {
    if (user.displayName !== LEGACY_DISPLAY_NAME) continue;
    await auth.deleteUser(user.uid);
    deleted.push(`auth/${user.uid}`);
  }
  nextPageToken = page.pageToken;
} while (nextPageToken);

console.log(`Legacy admin fixture purge complete. Removed ${deleted.length} reference(s).`);
for (const entry of deleted) console.log(`- ${entry}`);
