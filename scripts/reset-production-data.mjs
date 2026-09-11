import { createHash } from "node:crypto";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const EXPECTED_PROJECT = "coolock-ardlea-scouts";
const PRESERVE_EMAIL = "superadmin@example.com";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");

const credentials = JSON.parse(rawCredentials);
const projectId = String(credentials.project_id || "").trim();
if (projectId !== EXPECTED_PROJECT) {
  throw new Error(`Refusing production reset: credential project_id must be ${EXPECTED_PROJECT}; received ${projectId || "<empty>"}.`);
}

const execute = process.argv.includes("--execute");
const confirm = String(process.env.PROD_RESET_CONFIRMATION || "").trim();
const expectedFirestoreCount = Number.parseInt(process.env.PROD_RESET_EXPECTED_FIRESTORE_COUNT || "", 10);
const expectedAuthCount = Number.parseInt(process.env.PROD_RESET_EXPECTED_AUTH_COUNT || "", 10);
const expectedManifestSha256 = String(process.env.PROD_RESET_EXPECTED_MANIFEST_SHA256 || "").trim().toLowerCase();
const backupUri = String(process.env.PROD_RESET_BACKUP_URI || "").trim();

initializeApp({ credential: cert(credentials), projectId });
const db = getFirestore();
const auth = getAuth();

const preservedUser = await auth.getUserByEmail(PRESERVE_EMAIL);
const preservedAdminRef = db.collection("adminUsers").doc(preservedUser.uid);
const preservedAdmin = await preservedAdminRef.get();
if (!preservedAdmin.exists) {
  throw new Error(`Refusing reset: adminUsers/${preservedUser.uid} does not exist for ${PRESERVE_EMAIL}.`);
}
const adminData = preservedAdmin.data() || {};
if (adminData.active !== true || adminData.role !== "super-admin") {
  throw new Error(`Refusing reset: ${PRESERVE_EMAIL} must have active=true and role=super-admin before cleanup.`);
}

const firestoreTargets = [];
for (const collection of await db.listCollections()) {
  const snapshot = await collection.get();
  for (const doc of snapshot.docs) {
    if (doc.ref.path === preservedAdminRef.path) continue;
    firestoreTargets.push(doc.ref.path);
  }
}
firestoreTargets.sort();

const authTargets = [];
let nextPageToken;
do {
  const page = await auth.listUsers(1000, nextPageToken);
  for (const user of page.users) {
    if (user.uid !== preservedUser.uid) authTargets.push(user.uid);
  }
  nextPageToken = page.pageToken;
} while (nextPageToken);
authTargets.sort();

const manifest = [
  `project=${projectId}`,
  `preserve-auth=${preservedUser.uid}`,
  `preserve-firestore=${preservedAdminRef.path}`,
  ...firestoreTargets.map((path) => `delete-firestore=${path}`),
  ...authTargets.map((uid) => `delete-auth=${uid}`),
].join("\n");
const manifestSha256 = createHash("sha256").update(manifest).digest("hex");

console.log(JSON.stringify({
  mode: execute ? "reset" : "dry-run",
  projectId,
  preservedEmail: PRESERVE_EMAIL,
  preservedUid: preservedUser.uid,
  preservedFirestorePath: preservedAdminRef.path,
  firestoreDeleteCount: firestoreTargets.length,
  authDeleteCount: authTargets.length,
  manifestSha256,
}, null, 2));

if (!execute) {
  console.log("Dry run only. No Firestore documents or Authentication users were modified.");
  process.exit(0);
}

const problems = [];
if (confirm !== `REBUILD PRODUCTION ${EXPECTED_PROJECT}`) {
  problems.push(`PROD_RESET_CONFIRMATION must exactly equal REBUILD PRODUCTION ${EXPECTED_PROJECT}.`);
}
if (!Number.isInteger(expectedFirestoreCount) || expectedFirestoreCount !== firestoreTargets.length) {
  problems.push(`PROD_RESET_EXPECTED_FIRESTORE_COUNT must exactly equal ${firestoreTargets.length}.`);
}
if (!Number.isInteger(expectedAuthCount) || expectedAuthCount !== authTargets.length) {
  problems.push(`PROD_RESET_EXPECTED_AUTH_COUNT must exactly equal ${authTargets.length}.`);
}
if (!/^[a-f0-9]{64}$/.test(expectedManifestSha256) || expectedManifestSha256 !== manifestSha256) {
  problems.push(`PROD_RESET_EXPECTED_MANIFEST_SHA256 must exactly equal ${manifestSha256}.`);
}
if (!backupUri.startsWith("gs://") || !backupUri.includes("/firestore-backups/")) {
  problems.push("PROD_RESET_BACKUP_URI must identify the backup created for this rebuild under gs://.../firestore-backups/....");
}
if (problems.length) throw new Error(`Refusing destructive production reset:\n- ${problems.join("\n- ")}`);

for (const path of firestoreTargets) {
  await db.recursiveDelete(db.doc(path));
}

for (let offset = 0; offset < authTargets.length; offset += 1000) {
  const result = await auth.deleteUsers(authTargets.slice(offset, offset + 1000));
  if (result.failureCount) {
    throw new Error(`Authentication cleanup failed for ${result.failureCount} user(s).`);
  }
}

const preservedUserAfter = await auth.getUser(preservedUser.uid);
const preservedAdminAfter = await preservedAdminRef.get();
if (preservedUserAfter.email !== PRESERVE_EMAIL || !preservedAdminAfter.exists) {
  throw new Error("Post-reset preservation verification failed.");
}

console.log(`Production reset complete. Preserved only ${PRESERVE_EMAIL} (${preservedUser.uid}) and ${preservedAdminRef.path}.`);
