import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { aggregatePlan, planMemberImport } from "./member-import-core.mjs";

const execute = process.argv.includes("--execute");
const rollback = process.argv.includes("--rollback");
const manifestArg = process.argv.find((arg) => arg.startsWith("--manifest="));
if (!manifestArg) throw new Error("Usage: node scripts/import-members.mjs --manifest=/private/path.json [--execute|--rollback]");
if (execute && rollback) throw new Error("Choose either --execute or --rollback, not both.");

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required for project verification and Firestore comparison.");
const credentials = JSON.parse(rawCredentials);
const projectId = credentials.project_id;
if (!projectId) throw new Error("Service account project_id is required.");

const manifest = JSON.parse(await readFile(manifestArg.slice("--manifest=".length), "utf8"));
if (manifest?.version !== 1 || !Array.isArray(manifest.records)) throw new Error("Unsupported private member-import manifest.");
if ((manifest.preparationRejected || []).length > 0) throw new Error("Manifest preparation has rejected rows; resolve them before production comparison.");

const { cert, initializeApp } = await import("firebase-admin/app");
const { FieldValue, getFirestore } = await import("firebase-admin/firestore");
initializeApp({ credential: cert(credentials) });
const db = getFirestore();
const snapshot = await db.collection("members").get();
const existing = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
const plan = planMemberImport(manifest.records, existing);
const aggregate = aggregatePlan(plan);
const reviewedPayload = JSON.stringify({ batch: manifest.batch || "", creates: plan.creates.map((item) => ({ id: item.id, section: item.section, importBatch: item.importBatch })), matches: plan.matches, conflicts: plan.conflicts, rejected: plan.rejected });
const digest = createHash("sha256").update(reviewedPayload).digest("hex");

console.log(JSON.stringify({ mode: rollback ? "rollback-dry-run" : execute ? "execute" : "dry-run", projectId, batch: manifest.batch || "", ...aggregate, sourceExcluded: (manifest.preparationExcluded || []).length, manifestSha256: digest }, null, 2));
if (plan.conflicts.length) console.log(`Conflict reasons: ${JSON.stringify(Object.groupBy(plan.conflicts, (item) => item.reason), (_key, value) => value.length)}`);
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

for (const item of plan.creates) {
  const ref = db.collection("members").doc(item.id);
  const current = await ref.get();
  if (current.exists) throw new Error(`Refusing to overwrite existing member id ${item.id}.`);
  await ref.create({ ...item, createdAt: FieldValue.serverTimestamp(), createdBy: "CONTROLLED_MEMBER_IMPORT", updatedAt: FieldValue.serverTimestamp(), updatedBy: "CONTROLLED_MEMBER_IMPORT" });
}
console.log(`Import complete: ${plan.creates.length} member records created; ${plan.matches.length} legitimate existing matches left unchanged.`);
