import { readFile } from "node:fs/promises";
import { FIRESTORE_ADMIN_ONLY_ROOT_COLLECTIONS, FIRESTORE_ROOT_COLLECTIONS } from "./firestore-collection-contract.mjs";

const root = new URL("../", import.meta.url);
const rules = await readFile(new URL("firestore.rules", root), "utf8");
const compatibilityAudit = await readFile(new URL("scripts/audit-firestore-compatibility.mjs", root), "utf8");
const provenanceAudit = await readFile(new URL("scripts/audit-live-data-provenance.mjs", root), "utf8");
const workflow = await readFile(new URL(".github/workflows/firestore-data-audit.yml", root), "utf8");

const rulesCollections = new Set([...rules.matchAll(/^ {4}match \/([A-Za-z][A-Za-z0-9_-]*)\/\{[^/]+\}\s*\{/gm)].map((match) => match[1]));
const clientRuleCollections = new Set(FIRESTORE_ROOT_COLLECTIONS.filter((name) => !FIRESTORE_ADMIN_ONLY_ROOT_COLLECTIONS.includes(name)));
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

function compare(label, actual, expected) {
  const missing = [...expected].filter((name) => !actual.has(name)).sort();
  const extra = [...actual].filter((name) => !expected.has(name)).sort();
  if (missing.length) fail(`${label} is missing: ${missing.join(", ")}`);
  if (extra.length) fail(`${label} has unregistered collections: ${extra.join(", ")}`);
  if (!missing.length && !extra.length) console.log(`PASS: ${label} matches all ${expected.size} registered root collections.`);
}

compare("Firestore rules", rulesCollections, clientRuleCollections);

for (const [label, source] of [["Compatibility audit", compatibilityAudit], ["Provenance audit", provenanceAudit]]) {
  if (!source.includes('from "./firestore-collection-contract.mjs"')) fail(`${label} must import the shared root-collection contract.`);
  else console.log(`PASS: ${label} imports the shared root-collection contract.`);
}

for (const unsafeCommand of [
  "node scripts/reconcile-admin-user-sections.mjs\n",
  "node scripts/reconcile-meeting-records.mjs --apply"
]) {
  if (workflow.includes(unsafeCommand)) fail(`Read-only audit workflow contains a mutating command: ${unsafeCommand.trim()}`);
}
if (!failures.length) console.log("PASS: Firestore data audit workflow is read-only.");
if (!workflow.includes("Upload dry-run integrity report") || !workflow.includes("actions/upload-artifact@v4")) {
  fail("Read-only audit workflow must retain its downloadable dry-run report.");
} else {
  console.log("PASS: Firestore data audit workflow publishes a downloadable dry-run report.");
}

if (failures.length) {
  console.error(`\nFirestore audit coverage check failed with ${failures.length} issue(s).`);
  process.exit(1);
}
console.log("\nFirestore audit coverage contract passed.");
