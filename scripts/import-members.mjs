import { applicationDefault, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
import { aggregatePlan, planMemberImport } from "./member-import-core.mjs";

const execute = process.argv.includes("--execute");
const manifestArg = process.argv.find((arg) => arg.startsWith("--manifest="));
const projectArg = process.argv.find((arg) => arg.startsWith("--project="));
const confirmArg = process.argv.find((arg) => arg.startsWith("--confirm="));

if (!manifestArg || !projectArg) {
  throw new Error("Usage: npm run seed:members -- --manifest=/private/members.json --project=<firebase-project-id> [--execute --confirm=SEED-MEMBERS]");
}

const projectId = projectArg.slice("--project=".length).trim();
if (!projectId) throw new Error("--project must be the exact Firebase project ID.");
if (execute && confirmArg?.slice("--confirm=".length) !== "SEED-MEMBERS") {
  throw new Error("Writing members requires --execute --confirm=SEED-MEMBERS.");
}

const manifestPath = manifestArg.slice("--manifest=".length);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest?.version !== 1 || !Array.isArray(manifest.records)) {
  throw new Error("Unsupported private member seed manifest.");
}
if ((manifest.preparationRejected || []).length > 0) {
  throw new Error("Private member seed manifest contains rejected rows; resolve them before seeding.");
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const snapshot = await db.collection("members").get();
const existing = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
const plan = planMemberImport(manifest.records, existing);
const aggregate = aggregatePlan(plan);

console.log(JSON.stringify({
  mode: execute ? "seed" : "dry-run",
  projectId,
  batch: manifest.batch || "",
  ...aggregate,
  sourceExcluded: (manifest.preparationExcluded || []).length
}, null, 2));

if (plan.conflicts.length) {
  const reasons = plan.conflicts.reduce((counts, item) => {
    counts[item.reason] = (counts[item.reason] || 0) + 1;
    return counts;
  }, {});
  console.log(`Conflict reasons: ${JSON.stringify(reasons)}`);
}
if (plan.rejected.length) {
  console.log(`Rejected rows: ${plan.rejected.length}. Personal data is intentionally omitted from logs.`);
}

if (!execute) process.exit(0);
if (plan.conflicts.length || plan.rejected.length) {
  throw new Error("Refusing to seed while conflicts or rejected rows remain.");
}

for (const item of plan.creates) {
  const ref = db.collection("members").doc(item.id);
  const current = await ref.get();
  if (current.exists) throw new Error(`Refusing to overwrite existing member id ${item.id}.`);
  await ref.create({
    ...item,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: "CONTROLLED_MEMBER_SEED",
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: "CONTROLLED_MEMBER_SEED"
  });
}

console.log(`Member seed complete: ${plan.creates.length} created; ${plan.matches.length} existing matches left unchanged.`);
