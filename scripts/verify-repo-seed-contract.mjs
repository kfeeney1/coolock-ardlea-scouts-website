import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const APPROVED_SEEDS = [
  "scripts/seed-population-data.mjs",
  "scripts/seed-flow-data.mjs",
  "scripts/seed-public-site-content.mjs",
  "scripts/seed-playwright-records.mjs"
];
const EXCLUDED_DIRS = new Set([".git", "node_modules", "dist", "playwright-report", "test-results", ".firebase"]);
const MIGRATION_ONLY_FILES = new Set([
  "scripts/inspect-legacy-test-references.mjs",
  "scripts/repair-parent-account-linked-sections.mjs",
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
  "scripts/audit-firestore-compatibility.mjs",
  "scripts/audit-live-data-provenance.mjs"
]);
const NON_DATA_TOKENS = new Set(["TEST_EMAIL_REDIRECT", "TEST_SEEDS"]);
const TEXT_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".yml", ".yaml", ".md", ".rules", ".ps1"]);

for (const seed of APPROVED_SEEDS) {
  if (!existsSync(join(ROOT, seed))) throw new Error(`Approved seed source is missing: ${seed}`);
}
for (const retired of [
  "scripts/seed-test-data.mjs",
  "scripts/seed-e2e-auth-users.mjs",
  "scripts/backfill-organisation-leadership.mjs",
  "scripts/repair-firestore-compatibility.mjs"
]) {
  if (existsSync(join(ROOT, retired))) throw new Error(`Retired data source must be removed: ${retired}`);
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

const legacyForbidden = [
  "TEST_uid_admin_01",
  "test.admin@example.com",
  "Orla Kelly",
  "test.leader.parent@example.com",
  "test.leader.only@example.com",
  "test.leader.multisection@example.com"
];
const forbiddenRuntimePatterns = [
  { pattern: /data\.section\s*\|\|/g, label: "legacy leader section fallback" },
  { pattern: /data\.scoutSection/g, label: "legacy scoutSection read" },
  { pattern: /formType\s*===?\s*["']youth["']/g, label: "legacy youth formType" },
  { pattern: /formType\s*===?\s*["']scouter["']/g, label: "legacy scouter formType" },
  { pattern: /status[^\n]*\|\|\s*["']active["']/g, label: "fail-open active status default" },
  { pattern: /status[^\n]*\|\|\s*["']draft["']/g, label: "fail-open draft status default" },
  { pattern: /role[^\n]*\|\|\s*["']leader["']/g, label: "fail-open leader role default" }
];
const PUBLIC_PRESENTATION_ROOTS = ["src/pages/", "src/components/"];
const publicDataLiterals = [
  "80th 160th Coolock Ardlea Scout Group",
  "Ages 6–9",
  "Ages 9–12",
  "Ages 12–15",
  "Ages 15–18",
  "Ages 18–26"
];
const publicLiteralAllowedFiles = new Set([
  "src/services/publicSiteContent.ts"
]);

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

  if ((path.startsWith("src/") || path === "firestore.rules" || path.startsWith("email-worker/src/")) && !MIGRATION_ONLY_FILES.has(path)) {
    for (const { pattern, label } of forbiddenRuntimePatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) violations.push(`${path}: ${label}`);
    }
  }

  if (PUBLIC_PRESENTATION_ROOTS.some((root) => path.startsWith(root)) && !publicLiteralAllowedFiles.has(path)) {
    for (const literal of publicDataLiterals) {
      if (content.includes(literal)) violations.push(`${path}: mutable public/domain data literal must come from Firestore: ${literal}`);
    }
    if (/const\s+(?:sectionOptions|featureCards|menuItems)\s*=\s*\[/.test(content)) {
      violations.push(`${path}: mutable public option/content collection is hard-coded in presentation code`);
    }
  }
}

const obsoletePathPatterns = [
  /^leader-.*-backup-/,
  /(?:^|\/)JoinManagement\.tsx\.(?:filter|waiting-filter)-backup-/
];
for (const fullPath of walk(ROOT)) {
  const path = relative(ROOT, fullPath).replaceAll("\\", "/");
  if (obsoletePathPatterns.some((pattern) => pattern.test(path))) violations.push(`${path}: obsolete source backup must not remain in the supported repository`);
}

if (violations.length) {
  console.error("Repository canonical data-contract violations found:");
  for (const violation of [...new Set(violations)].sort()) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Repository seed contract verified against ${APPROVED_SEEDS.length} canonical seed sources.`);
console.log("Runtime code may not silently accept legacy aliases, presentation code may not own mutable organisation/domain content, and obsolete source backups are forbidden.");
