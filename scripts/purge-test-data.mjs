import { createHash } from "node:crypto";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { classifyTestDocument } from "./test-data-detection.mjs";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

const credentials = JSON.parse(rawCredentials);
const projectId = credentials.project_id;
if (!projectId) throw new Error("Service account JSON must include project_id.");

const execute = process.argv.includes("--execute");
const confirmProject = (process.env.TEST_DATA_PURGE_CONFIRM_PROJECT || "").trim();
const expectedFirestoreCount = Number.parseInt(process.env.TEST_DATA_PURGE_EXPECTED_FIRESTORE_COUNT || "", 10);
const expectedAuthCount = Number.parseInt(process.env.TEST_DATA_PURGE_EXPECTED_AUTH_COUNT || "", 10);
const expectedManifestSha256 = (process.env.TEST_DATA_PURGE_EXPECTED_MANIFEST_SHA256 || "").trim().toLowerCase();
const backupUri = (process.env.TEST_DATA_PURGE_BACKUP_URI || "").trim();
const backupVerifiedAt = (process.env.TEST_DATA_PURGE_BACKUP_VERIFIED_AT || "").trim();
const MAX_BACKUP_AGE_MS = 192 * 60 * 60 * 1000;

initializeApp({ credential: cert(credentials), projectId });
const db = getFirestore();
const auth = getAuth();

async function collectTargets() {
  const firestore = [];
  for (const collection of await db.listCollections()) {
    const snapshot = await collection.get();
    for (const doc of snapshot.docs) {
      const reasons = classifyTestDocument(doc);
      if (reasons.length) firestore.push({ path: doc.ref.path, ref: doc.ref, reasons });
    }
  }

  const authUsers = [];
  let nextPageToken;
  do {
    const page = await auth.listUsers(1000, nextPageToken);
    for (const user of page.users) {
      if (user.uid.startsWith("TEST_")) authUsers.push(user.uid);
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  firestore.sort((a, b) => a.path.localeCompare(b.path));
  authUsers.sort();
  return { firestore, authUsers };
}

function manifestFor(targets) {
  return [
    `project=${projectId}`,
    ...targets.firestore.map(({ path, reasons }) => `firestore:${path}:${reasons.join(",")}`),
    ...targets.authUsers.map((uid) => `auth:${uid}`),
  ].join("\n");
}

function validateExecutionGates(targets, manifestSha256) {
  const problems = [];
  if (confirmProject !== projectId) {
    problems.push(`TEST_DATA_PURGE_CONFIRM_PROJECT must exactly equal ${projectId}.`);
  }
  if (!Number.isInteger(expectedFirestoreCount) || expectedFirestoreCount !== targets.firestore.length) {
    problems.push(`TEST_DATA_PURGE_EXPECTED_FIRESTORE_COUNT must exactly equal ${targets.firestore.length}.`);
  }
  if (!Number.isInteger(expectedAuthCount) || expectedAuthCount !== targets.authUsers.length) {
    problems.push(`TEST_DATA_PURGE_EXPECTED_AUTH_COUNT must exactly equal ${targets.authUsers.length}.`);
  }
  if (!/^[a-f0-9]{64}$/.test(expectedManifestSha256) || expectedManifestSha256 !== manifestSha256) {
    problems.push(`TEST_DATA_PURGE_EXPECTED_MANIFEST_SHA256 must exactly equal ${manifestSha256}.`);
  }
  if (!backupUri.startsWith("gs://") || !backupUri.includes("/firestore-backups/")) {
    problems.push("TEST_DATA_PURGE_BACKUP_URI must identify a reviewed Firestore backup under gs://.../firestore-backups/....");
  }
  const verifiedAtMs = Date.parse(backupVerifiedAt);
  if (!Number.isFinite(verifiedAtMs)) {
    problems.push("TEST_DATA_PURGE_BACKUP_VERIFIED_AT must be a valid ISO-8601 timestamp.");
  } else {
    const age = Date.now() - verifiedAtMs;
    if (age < 0 || age > MAX_BACKUP_AGE_MS) {
      problems.push("TEST_DATA_PURGE_BACKUP_VERIFIED_AT must be no more than 192 hours old and not in the future.");
    }
  }
  if (problems.length) throw new Error(`Refusing destructive cleanup:\n- ${problems.join("\n- ")}`);
}

async function deleteFirestore(targets) {
  let deleted = 0;
  for (let offset = 0; offset < targets.length; offset += 400) {
    const batch = db.batch();
    for (const target of targets.slice(offset, offset + 400)) batch.delete(target.ref);
    await batch.commit();
    deleted += Math.min(400, targets.length - offset);
  }
  return deleted;
}

async function deleteAuth(uids) {
  let deleted = 0;
  for (const uid of uids) {
    await auth.deleteUser(uid);
    deleted += 1;
  }
  return deleted;
}

const targets = await collectTargets();
const manifest = manifestFor(targets);
const manifestSha256 = createHash("sha256").update(manifest).digest("hex");

console.log(`TEST-data cleanup target project: ${projectId}`);
console.log(`Firestore candidate documents: ${targets.firestore.length}`);
console.log(`Firebase Auth TEST_ users: ${targets.authUsers.length}`);
console.log(`Manifest SHA-256: ${manifestSha256}`);
console.log("Firestore targets:");
for (const target of targets.firestore) console.log(`- ${target.path} [${target.reasons.join(", ")}]`);
console.log("Firebase Auth targets:");
for (const uid of targets.authUsers) console.log(`- ${uid}`);

if (!execute) {
  console.log("Dry run only. No records or users were modified or deleted.");
  console.log("To execute, review this exact target set, verify a fresh backup, then rerun with --execute and every TEST_DATA_PURGE_* confirmation variable set to the values printed/reviewed above.");
  process.exit(0);
}

validateExecutionGates(targets, manifestSha256);
console.log(`Execution gates passed. Verified backup: ${backupUri}`);
const firestoreDeleted = await deleteFirestore(targets.firestore);
const authDeleted = await deleteAuth(targets.authUsers);
console.log(`Deleted ${firestoreDeleted} Firestore TEST-data document(s).`);
console.log(`Deleted ${authDeleted} Firebase Auth TEST_ user(s).`);
console.log("Production TEST-data cleanup complete. Rerun the read-only Firestore Data Provenance Audit immediately.");
