import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const auth = getAuth();

function isMarkedTestDocument(doc) {
  const data = doc.data();
  if (data?.testData !== true) return false;
  return doc.id.startsWith("TEST") || data.createdBySeed === "TEST_SEED" || typeof data.testSeed === "string";
}

async function purgeFirestore() {
  const collections = await db.listCollections();
  let deleted = 0;

  for (const collection of collections) {
    const snapshot = await collection.get();
    const targets = snapshot.docs.filter(isMarkedTestDocument);
    for (let offset = 0; offset < targets.length; offset += 400) {
      const batch = db.batch();
      for (const doc of targets.slice(offset, offset + 400)) batch.delete(doc.ref);
      await batch.commit();
    }
    if (targets.length) console.log(`Deleted ${targets.length} marked test document(s) from ${collection.id}.`);
    deleted += targets.length;
  }

  console.log(`Deleted ${deleted} marked Firestore test document(s) in total.`);
}

async function purgeAuth() {
  let nextPageToken;
  let deleted = 0;
  do {
    const page = await auth.listUsers(1000, nextPageToken);
    const testUsers = page.users.filter((user) => user.uid.startsWith("TEST_"));
    for (const user of testUsers) await auth.deleteUser(user.uid);
    deleted += testUsers.length;
    nextPageToken = page.pageToken;
  } while (nextPageToken);
  console.log(`Deleted ${deleted} TEST_ Firebase Auth user(s).`);
}

console.log("Purging marked TEST data only. Unmarked records are never targeted.");
await purgeFirestore();
await purgeAuth();
console.log("Marked TEST data purge complete.");
