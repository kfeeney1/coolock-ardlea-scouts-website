import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const APPROVED_SEEDS = [
  "scripts/seed-population-data.mjs",
  "scripts/seed-flow-data.mjs",
  "scripts/seed-test-data.mjs",
  "scripts/seed-e2e-auth-users.mjs",
  "scripts/seed-playwright-records.mjs"
];
const EXCLUDED_DIRS = new Set([".git", "node_modules", "dist", "playwright-report", "test-results", ".firebase"]);
const MIGRATION_ONLY_FILES = new Set([
  "scripts/backfill-organisation-leadership.mjs",
  "scripts/inspect-legacy-test-references.mjs",
  "scripts/repair-firestore-compatibility.mjs",
  "scripts/reconcile-seeded-accounts.mjs",
  "scripts/purge-test-data.mjs",
  "tests/unit/noLegacyAdminFixture.test.ts"
]);
const EXCLUDED_FILES = new Set([
  ...APPROVED_SEEDS,
  ...MIGRATION_ONLY_FILES,
  "scripts/verify-repo-seed-contract.mjs",
  "scripts/verify-playwright-seed-contract.mjs",
  "scripts/verify-test-population.mjs",
  "scripts/verify-flow-data.mjs",
  "scripts/audit-firestore-compatibility.mjs"
]);
const NON_DATA_TOKENS = new Set(["TEST_EMAIL_REDIRECT", "TEST_ROLE_OVERRIDES"]);
const TEXT_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".yml", ".yaml", ".md", ".rules"]);

for (const seed of APPROVED_SEEDS) {
  if (!existsSync(join(ROOT, seed))) throw new Error(`Approved seed source is missing: ${seed}`);
}

const seedCorpus = APPROVED_SEEDS.map((file) => readFileSync(join(ROOT, file), "utf8")).join("\n");
const allowedTokens = new Set(seedCorpus.match(/TEST_[A-Za-z0-9_-]+/g) || []);
const allowedCompactTokens = new Set(seedCorpus.match(/TEST[A-Z0-9]{6,}/g) || []);
const allowedEmails = new Set(seedCorpus.match(/[A-Za-z0-9._%+-]+@example\.com/g) || []);

const sectionKeys = ["beaver", "cub", "scout", "venture", "rover"];
const sectionRoleKeys = ["section_leader", "assistant_section_leader", "programme_scouter", "scouter"];
const groupRoleKeys = ["group_leader", "group_chairperson", "group_secretary", "group_treasurer", "group_quartermaster", "group_youth_champion"];

for (const section of sectionKeys) {
  for (let i = 1; i <= 30; i += 1) {
    const n = String(i).padStart(2, "0");
    allowedTokens.add(`TEST_member_${section}_${n}`);
    allowedEmails.add(`test.${section}.${n}.parent@example.com`);
  }
  for (const role of sectionRoleKeys) {
    allowedTokens.add(`TEST_uid_${section}_${role}`);
    allowedEmails.add(`test.${section}.${role.replaceAll("_", ".")}@example.com`);
  }
  for (const n of [1, 2]) {
    allowedTokens.add(`TEST_uid_${section}_parent_${n}`);
    allowedEmails.add(`test.${section}.parent${n}@example.com`);
  }
}
for (const role of groupRoleKeys) {
  allowedTokens.add(`TEST_uid_${role}`);
  allowedEmails.add(`test.${role.replaceAll("_", ".")}@example.com`);
}

const legacyForbidden = ["TEST_uid_admin_01", "test.admin@example.com", "Orla Kelly"];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function ext(path) {
  const match = path.match(/(\.[^.\/]+)$/);
  return match?.[1] || "";
}

const violations = [];
for (const fullPath of walk(ROOT)) {
  const path = relative(ROOT, fullPath).replaceAll("\\", "/");
  if (EXCLUDED_FILES.has(path) || path.startsWith("scripts/seed-")) continue;
  if (!TEXT_EXTENSIONS.has(ext(path))) continue;
  const content = readFileSync(fullPath, "utf8");

  for (const forbidden of legacyForbidden) {
    if (content.includes(forbidden)) violations.push(`${path}: legacy value ${forbidden}`);
  }

  for (const token of new Set(content.match(/TEST_[A-Za-z0-9_-]+/g) || [])) {
    if (!allowedTokens.has(token) && !NON_DATA_TOKENS.has(token)) violations.push(`${path}: unseeded identifier ${token}`);
  }
  for (const token of new Set(content.match(/TEST[A-Z0-9]{6,}/g) || [])) {
    if (!allowedCompactTokens.has(token) && !NON_DATA_TOKENS.has(token)) violations.push(`${path}: unseeded token ${token}`);
  }
  for (const email of new Set(content.match(/[A-Za-z0-9._%+-]+@example\.com/g) || [])) {
    if (email.startsWith("test.") && !allowedEmails.has(email)) violations.push(`${path}: unseeded test email ${email}`);
  }
}

if (violations.length) {
  console.error("Repository seed-contract violations found:");
  for (const violation of [...new Set(violations)].sort()) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Repository seed contract verified against ${APPROVED_SEEDS.length} active seed sources.`);
console.log("Migration/repair files are isolated from the consumer contract and may reference legacy IDs solely to remove or repair them.");
