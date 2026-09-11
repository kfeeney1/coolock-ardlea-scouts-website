import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { smokeSpecs, suiteSpecs } from "./playwright-suites.mjs";

const root = process.cwd();
const e2eDir = path.join(root, "e2e");

async function collectSpecs(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectSpecs(fullPath)));
    else if (entry.isFile() && entry.name.endsWith(".spec.ts")) files.push(fullPath);
  }
  return files;
}

const rules = [
  {
    name: "fixed sleeps",
    pattern: /\b(?:page|frame)\.waitForTimeout\s*\(/g,
    message: "Use locator assertions, event waits, or expect.poll instead of fixed sleeps."
  },
  {
    name: "networkidle waits",
    pattern: /waitUntil\s*:\s*["']networkidle["']/g,
    message: "Avoid networkidle for Firebase-driven UI; wait for a user-visible state instead."
  },
  {
    name: "focused tests",
    pattern: /\btest(?:\.describe)?\.only\s*\(/g,
    message: "Focused tests must not be committed."
  },
  {
    name: "hard-coded canonical password",
    pattern: /["']password1["']/g,
    message: "Read test credentials from E2E_TEST_USER_PASSWORD rather than embedding them in specs."
  }
];

const specs = await collectSpecs(e2eDir);
const failures = [];
let testCalls = 0;

for (const filename of specs) {
  const source = await readFile(filename, "utf8");
  const relative = path.relative(root, filename).replaceAll(path.sep, "/");
  const importsPlaywright = /from\s+["']@playwright\/test["']/.test(source);
  if (!importsPlaywright) failures.push(`${relative}: must import Playwright from @playwright/test.`);

  testCalls += (source.match(/\btest\s*\(/g) || []).length;
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const match of source.matchAll(rule.pattern)) {
      const line = source.slice(0, match.index).split("\n").length;
      failures.push(`${relative}:${line}: ${rule.name}: ${rule.message}`);
    }
  }
}

if (specs.length === 0 || testCalls === 0) failures.push("No Playwright specs/tests were discovered under e2e/.");

const discoveredNames = specs.map((filename) => path.basename(filename)).sort();
const ownership = new Map();
for (const [suite, names] of Object.entries(suiteSpecs)) {
  for (const name of names) {
    const owners = ownership.get(name) ?? [];
    owners.push(suite);
    ownership.set(name, owners);
  }
}

for (const name of discoveredNames) {
  const owners = ownership.get(name) ?? [];
  if (owners.length === 0) failures.push(`e2e/${name}: missing functional-suite ownership in scripts/playwright-suites.mjs.`);
  if (owners.length > 1) failures.push(`e2e/${name}: assigned to multiple functional suites: ${owners.join(", ")}.`);
}
for (const [name, owners] of ownership) {
  if (!discoveredNames.includes(name)) failures.push(`${name}: suite manifest references a spec that does not exist (${owners.join(", ")}).`);
}
for (const name of smokeSpecs) {
  if (!discoveredNames.includes(name)) failures.push(`${name}: smoke manifest references a spec that does not exist.`);
}

if (failures.length > 0) {
  console.error("Playwright suite contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Playwright suite contract OK: ${specs.length} spec files, ${testCalls} test declarations, ${Object.keys(suiteSpecs).length} functional suites.`);
