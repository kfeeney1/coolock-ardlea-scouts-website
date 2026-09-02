import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { classifyTestDocument } from "./test-data-detection.mjs";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const auth = getAuth();

const firestoreCandidates = [];
const collections = await db.listCollections();
for (const collection of collections) {
  const snapshot = await collection.get();
  for (const doc of snapshot.docs) {
    const reasons = classifyTestDocument(doc);
    if (reasons.length) {
      firestoreCandidates.push({ collection: collection.id, id: doc.id, reasons });
    }
  }
}

const authCandidates = [];
let nextPageToken;
do {
  const page = await auth.listUsers(1000, nextPageToken);
  for (const user of page.users) {
    if (user.uid.startsWith("TEST_")) authCandidates.push(user.uid);
  }
  nextPageToken = page.pageToken;
} while (nextPageToken);

authCandidates.sort();
firestoreCandidates.sort((a, b) => `${a.collection}/${a.id}`.localeCompare(`${b.collection}/${b.id}`));

const byCollection = new Map();
for (const candidate of firestoreCandidates) {
  byCollection.set(candidate.collection, (byCollection.get(candidate.collection) ?? 0) + 1);
}

console.log("Live TEST-data inventory (read-only)");
console.log(`Firestore candidate documents: ${firestoreCandidates.length}`);
for (const [collection, count] of [...byCollection.entries()].sort()) {
  console.log(`- ${collection}: ${count}`);
}
console.log(`Firebase Auth TEST_ users: ${authCandidates.length}`);

if (firestoreCandidates.length) {
  console.log("\nFirestore candidate paths and detection reasons:");
  for (const candidate of firestoreCandidates) {
    console.log(`- ${candidate.collection}/${candidate.id} [${candidate.reasons.join(", ")}]`);
  }
}

if (authCandidates.length) {
  console.log("\nFirebase Auth TEST_ UIDs:");
  for (const uid of authCandidates) console.log(`- ${uid}`);
}

if (!firestoreCandidates.length && !authCandidates.length) {
  console.log("\nNo TEST-data candidates were found in Firestore or Firebase Auth.");
} else {
  console.log("\nInventory complete. No records or users were modified or deleted.");
}
