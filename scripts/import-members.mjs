import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gcloudExecutable } from "./member-import-auth.mjs";
import { aggregatePlan, planMemberImport } from "./member-import-core.mjs";

const execute = process.argv.includes("--execute");
const rollback = process.argv.includes("--rollback");
const manifestArg = process.argv.find((arg) => arg.startsWith("--manifest="));
if (!manifestArg) throw new Error("Usage: node scripts/import-members.mjs --manifest=/private/path.json [--execute|--rollback]");
if (execute && rollback) throw new Error("Choose either --execute or --rollback, not both.");

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const confirmedProject = process.env.PROD_MEMBER_IMPORT_CONFIRM_PROJECT;
let projectId;
let db = null;
let authMode;

async function readMembersWithServiceAccount(credentials) {
  const { cert, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  initializeApp({ credential: cert(credentials) });
  db = getFirestore();
  const snapshot = await db.collection("members").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function firestoreString(fields, fieldName) {
  const value = fields?.[fieldName];
  return value && Object.hasOwn(value, "stringValue") ? value.stringValue : undefined;
}

async function readMembersWithApplicationDefaultCredentials(targetProjectId) {
  let accessToken;
  try {
    accessToken = execFileSync(gcloudExecutable(), ["auth", "application-default", "print-access-token"], {
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch {
    throw new Error("ADC dry-run requires Google Cloud CLI and `gcloud auth application-default login`.");
  }
  if (!accessToken) throw new Error("ADC access token was empty.");

  const members = [];
  let pageToken = "";
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(targetProjectId)}/databases/(default)/documents/members`);
    url.searchParams.set("pageSize", "300");
    url.searchParams.append("mask.fieldPaths", "displayName");
    url.searchParams.append("mask.fieldPaths", "dateOfBirth");
    url.searchParams.append("mask.fieldPaths", "section");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Firestore ADC comparison failed with HTTP ${response.status}; no response body was logged to protect member data.`);
    const payload = await response.json();
    for (const document of payload.documents || []) {
      members.push({
        id: decodeURIComponent(document.name.split("/").at(-1)),
        displayName: firestoreString(document.fields, "displayName"),
        dateOfBirth: firestoreString(document.fields, "dateOfBirth"),
        section: firestoreString(document.fields, "section")
      });
    }
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return members;
}

function countConflictReasons(conflicts) {
  return conflicts.reduce((counts, item) => {
    counts[item.reason] = (counts[item.reason] || 0) + 1;
    return counts;
  }, {});
}

const manifest = JSON.parse(await readFile(manifestArg.slice("--manifest=".length), "utf8"));
if (manifest?.version !== 1 || !Array.isArray(manifest.records)) throw new Error("Unsupported private member-import manifest.");
if ((manifest.preparationRejected || []).length > 0) throw new Error("Manifest preparation has rejected rows; resolve them before production comparison.");

let existing;
if (rawCredentials) {
  const credentials = JSON.parse(rawCredentials);
  projectId = credentials.project_id;
  if (!projectId) throw new Error("Service account project_id is required.");
  existing = await readMembersWithServiceAccount(credentials);
  authMode = "service-account";
} else {
  if (execute || rollback) throw new Error("Production mutation still requires FIREBASE_SERVICE_ACCOUNT_JSON; ADC is dry-run only.");
  if (!confirmedProject) throw new Error("ADC dry-run requires PROD_MEMBER_IMPORT_CONFIRM_PROJECT to explicitly select the Firestore project.");
  projectId = confirmedProject;
  existing = await readMembersWithApplicationDefaultCredentials(projectId);
  authMode = "application-default";
}

const plan = planMemberImport(manifest.records, existing);
const aggregate = aggregatePlan(plan);
const reviewedPayload = JSON.stringify({ batch: manifest.batch || "", creates: plan.creates.map((item) => ({ id: item.id, section: item.section, importBatch: item.importBatch })), matches: plan.matches, conflicts: plan.conflicts, rejected: plan.rejected });
const digest = createHash("sha256").update(reviewedPayload).digest("hex");

console.log(JSON.stringify({ mode: rollback ? "rollback-dry-run" : execute ? "execute" : "dry-run", authMode, projectId, batch: manifest.batch || "", ...aggregate, sourceExcluded: (manifest.preparationExcluded || []).length, manifestSha256: digest }, null, 2));
if (plan.conflicts.length) console.log(`Conflict reasons: ${JSON.stringify(countConflictReasons(plan.conflicts))}`);
if (plan.rejected.length) console.log(`Rejected rows: ${plan.rejected.length}. Source references are intentionally omitted from logs.`);

if (!execute && !rollback) process.exit(0);
if (plan.conflicts.length || plan.rejected.length) throw new Error("Refusing production mutation while conflicts or rejected rows remain.");

const required = {
  project: process.env.PROD_MEMBER_IMPORT_CONFIRM_PROJECT,
  creates: process.env.PROD_MEMBER_IMPORT_EXPECTED_CREATE_COUNT,
  matches: process.env.PROD_MEMBER_IMPORT_EXPECTED_MATCH_COUNT,
  digest: process.env.PROD_MEMBER_IMPORT_EXPECTED_MANIFEST_SHA256,
  backupUri: process.env.PROD_MEMBER_IMPORT_BACKUP_URI,
  backupVerifiedAt: process.env.PROD_MEMBER_IMPORT_BACKUP_VERIFIED_AT
};
if (required.project !== projectId) throw new Error("Target-project confirmation does not match service account project_id.");
if (Number(required.creates) !== plan.creates.length) throw new Error("Expected create count changed since review.");
if (Number(required.matches) !== plan.matches.length) throw new Error("Expected match count changed since review.");
if (required.digest !== digest) throw new Error("Reviewed manifest digest changed since dry-run.");
if (!required.backupUri?.startsWith("gs://") || !required.backupUri.includes("firestore-backups")) throw new Error("A reviewed Firestore backup URI is required.");
const backupAge = Date.now() - Date.parse(required.backupVerifiedAt || "");
if (!Number.isFinite(backupAge) || backupAge < 0 || backupAge > 192 * 60 * 60 * 1000) throw new Error("Backup verification must be a valid timestamp no more than 192 hours old.");

if (rollback) {
  let deleted = 0;
  for (const item of plan.creates) {
    const ref = db.collection("members").doc(item.id);
    const current = await ref.get();
    if (!current.exists) continue;
    const data = current.data();
    if (data?.source !== "spreadsheet-import" || data?.importBatch !== item.importBatch || data?.importSourceRef !== item.importSourceRef) throw new Error(`Rollback provenance mismatch for reviewed member id ${item.id}.`);
    await ref.delete();
    deleted += 1;
  }
  console.log(`Rollback complete: ${deleted} reviewed spreadsheet-import member records deleted.`);
  process.exit(0);
}

const { FieldValue } = await import("firebase-admin/firestore");
for (const item of plan.creates) {
  const ref = db.collection("members").doc(item.id);
  const current = await ref.get();
  if (current.exists) throw new Error(`Refusing to overwrite existing member id ${item.id}.`);
  await ref.create({ ...item, createdAt: FieldValue.serverTimestamp(), createdBy: "CONTROLLED_MEMBER_IMPORT", updatedAt: FieldValue.serverTimestamp(), updatedBy: "CONTROLLED_MEMBER_IMPORT" });
}
console.log(`Import complete: ${plan.creates.length} member records created; ${plan.matches.length} legitimate existing matches left unchanged.`);
