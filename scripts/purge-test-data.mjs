import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const auth = getAuth();

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isMarkedTestDocument(doc) {
  const data = doc.data();
  if (data?.testData !== true) return false;
  return doc.id.startsWith("TEST") || data.createdBySeed === "TEST_SEED" || typeof data.testSeed === "string";
}

function isLegacyTestReference(doc) {
  const data = doc.data();
  const id = doc.id;
  const eventId = text(data?.eventId);
  const memberId = text(data?.memberId);
  const uid = text(data?.uid);

  // Older seed versions did not consistently add testData/testSeed markers to
  // projection/link records. Only treat a document as legacy test data when a
  // stable test identifier is present in the document id or an explicit
  // reference field; this deliberately avoids broad name/title matching.
  return (
    id.startsWith("TEST_") ||
    eventId.startsWith("TEST_") ||
    memberId.startsWith("TEST_") ||
    uid.startsWith("TEST_")
  );
}

async function purgeFirestore() {
  const collections = await db.listCollections();
  let deleted = 0;

  for (const collection of collections) {
    const snapshot = await collection.get();
    const targets = snapshot.docs.filter((doc) => isMarkedTestDocument(doc) || isLegacyTestReference(doc));
    for (let offset = 0; offset < targets.length; offset += 400) {
      const batch = db.batch();
      for (const doc of targets.slice(offset, offset + 400)) batch.delete(doc.ref);
      await batch.commit();
    }
    if (targets.length) console.log(`Deleted ${targets.length} marked/legacy test document(s) from ${collection.id}.`);
    deleted += targets.length;
  }

  console.log(`Deleted ${deleted} marked/legacy Firestore test document(s) in total.`);
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

console.log("Purging marked and legacy TEST data only. Unrelated unmarked records are never targeted.");
await purgeFirestore();
await purgeAuth();
console.log("TEST data purge complete.");
