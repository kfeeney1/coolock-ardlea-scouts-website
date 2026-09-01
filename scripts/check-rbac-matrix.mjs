import { readFile } from "node:fs/promises";

import { FIRESTORE_ROOT_COLLECTIONS } from "./firestore-collection-contract.mjs";

const root = new URL("../", import.meta.url);
const app = await readFile(new URL("src/App.tsx", root), "utf8");
const matrix = JSON.parse(await readFile(new URL("config/rbac-matrix.json", root), "utf8"));
const firestoreRules = await readFile(new URL("firestore.rules", root), "utf8");
const storageRules = await readFile(new URL("storage.rules", root), "utf8");
const failures = [];

function fail(message) { failures.push(message); console.error(`FAIL: ${message}`); }
function pass(message) { console.log(`PASS: ${message}`); }
function compare(label, actual, expected) {
  const missing = [...expected].filter((value) => !actual.has(value)).sort();
  const extra = [...actual].filter((value) => !expected.has(value)).sort();
  if (missing.length) fail(`${label} is missing: ${missing.join(", ")}`);
  if (extra.length) fail(`${label} has stale entries: ${extra.join(", ")}`);
  if (!missing.length && !extra.length) pass(`${label} covers all ${expected.size} current entries.`);
}

if (matrix.version !== 1) fail("RBAC matrix version must be 1.");
const expectedIdentities = new Set(["public", "parent", "leader", "admin", "super-admin"]);
compare("RBAC identities", new Set(matrix.identities || []), expectedIdentities);

const appRoutes = new Set([...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]));
compare("Route matrix", new Set(Object.keys(matrix.routes || {})), appRoutes);
for (const route of appRoutes) {
  const gate = matrix.routes[route];
  const routeSource = app.match(new RegExp(`<Route\\s+path="${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]+`))?.[0] || "";
  if (route.startsWith("/leader/") && !["/leader/login", "/leader/register"].includes(route) && !gate.startsWith("leader") && !["admin", "group-audit-role"].includes(gate)) fail(`${route} has invalid leader-area gate ${JSON.stringify(gate)}.`);
  const usesLeaderGuard = routeSource.includes("protectedRoute") || (route === "/leader/settings" && routeSource.includes("protectedSettingsRoute"));
  if (["leader", "admin", "group-audit-role"].includes(gate) && !usesLeaderGuard) fail(`${route} must use a leader authentication guard.`);
}
for (const route of ["/leader/requests", "/leader/access", "/leader/parent-access", "/leader/settings"]) {
  if (matrix.routes[route] !== "admin") fail(`${route} must remain admin-gated in the RBAC matrix.`);
}
if (!app.includes('path="/leader/settings" element={protectedSettingsRoute(')) fail("Site Settings must retain its dedicated admin route guard.");
else pass("Site Settings retains its dedicated admin route guard.");

compare("Firestore RBAC matrix", new Set(Object.keys(matrix.firestore || {})), new Set(FIRESTORE_ROOT_COLLECTIONS));
for (const collectionName of FIRESTORE_ROOT_COLLECTIONS) {
  if (matrix.firestore[collectionName] !== "admin-sdk-only" && !firestoreRules.includes(`match /${collectionName}/{`)) fail(`${collectionName} has no Firestore Rules match.`);
}

const expectedStorage = new Set(["attachments/finance-receipts", "attachments/event-gallery"]);
compare("Storage RBAC matrix", new Set(Object.keys(matrix.storage || {})), expectedStorage);
for (const path of expectedStorage) if (!storageRules.includes(`match /${path}/`)) fail(`${path} has no Storage Rules match.`);

if (failures.length) {
  console.error(`\nRBAC matrix check failed with ${failures.length} issue(s).`);
  process.exit(1);
}
console.log("\nRBAC matrix contract passed.");
