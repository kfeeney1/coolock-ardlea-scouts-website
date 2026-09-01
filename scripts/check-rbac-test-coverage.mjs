import { readdir, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const matrix = JSON.parse(await readFile(new URL("config/rbac-matrix.json", root), "utf8"));
const failures = [];

async function loadRuleTests(directory) {
  const url = new URL(`${directory}/`, root);
  const names = (await readdir(url)).filter((name) => name.endsWith(".test.mjs")).sort();
  return Promise.all(names.map(async (name) => ({
    path: `${directory}/${name}`,
    source: await readFile(new URL(name, url), "utf8"),
  })));
}

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

function verifyDomain(kind, domain, tests) {
  const candidates = tests.filter(({ source }) => source.includes(domain));
  if (!candidates.length) {
    fail(`${kind} domain ${domain} has no Rules emulator test reference.`);
    return;
  }
  const hasAllowed = candidates.some(({ source }) => source.includes("assertSucceeds("));
  const hasDenied = candidates.some(({ source }) => source.includes("assertFails("));
  if (!hasAllowed) fail(`${kind} domain ${domain} has no positive permission assertion.`);
  if (!hasDenied) fail(`${kind} domain ${domain} has no negative permission assertion.`);
  if (hasAllowed && hasDenied) console.log(`PASS: ${kind} domain ${domain} has positive and negative Rules coverage.`);
}

const [firestoreTests, storageTests] = await Promise.all([
  loadRuleTests("tests/firestore"),
  loadRuleTests("tests/storage"),
]);

for (const domain of Object.keys(matrix.firestore).sort()) verifyDomain("Firestore", domain, firestoreTests);
for (const domain of Object.keys(matrix.storage).sort()) verifyDomain("Storage", domain, storageTests);

if (failures.length) {
  console.error(`\nRBAC test coverage check failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`\nRBAC test coverage contract passed for ${Object.keys(matrix.firestore).length} Firestore and ${Object.keys(matrix.storage).length} Storage domains.`);
