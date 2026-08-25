import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const populationSeedPath = "scripts/seed-population-data.mjs";
const workflowPath = ".github/workflows/playwright-e2e.yml";
const weeklySeedPath = "scripts/seed-playwright-records.mjs";
const populationSeed = readFileSync(populationSeedPath, "utf8");
const workflow = readFileSync(workflowPath, "utf8");
const weeklySeed = readFileSync(weeklySeedPath, "utf8");

const seededEmails = new Set([...populationSeed.matchAll(/email:\s*"([^"]+@example\.com)"/g)].map((match) => match[1]));
const seededUids = new Set([...populationSeed.matchAll(/uid:\s*(?:"([^"]+)"|WEB_ADMIN_UID)/g)].map((match) => match[1] || "TEST_uid_web_admin_01"));
const generatedSections = ["beaver", "cub", "scout", "venture", "rover"];
const generatedSectionRoles = ["section.leader", "assistant.section.leader", "programme.scouter", "scouter"];
const generatedGroupRoles = ["group.leader", "group.chairperson", "group.secretary", "group.treasurer", "group.quartermaster", "group.youth.champion"];
for (const section of generatedSections) {
  for (let number = 1; number <= 30; number += 1) seededEmails.add(`test.${section}.${String(number).padStart(2, "0")}.parent@example.com`);
  for (const role of generatedSectionRoles) seededEmails.add(`test.${section}.${role}@example.com`);
  for (const number of [1, 2]) seededEmails.add(`test.${section}.parent${number}@example.com`);
}
for (const role of generatedGroupRoles) seededEmails.add(`test.${role}@example.com`);

const envAccountKeys = ["E2E_PARENT_EMAIL","E2E_PARENT_LEADER_EMAIL","E2E_LEADER_EMAIL","E2E_MULTI_SECTION_LEADER_EMAIL","E2E_ADMIN_EMAIL","E2E_SUPER_ADMIN_EMAIL"];
const problems = [];
for (const key of envAccountKeys) {
  const match = workflow.match(new RegExp(`^\\s*${key}:\\s*([^\\s#]+)`, "m"));
  if (!match) { problems.push(`${workflowPath} is missing ${key}`); continue; }
  const email = match[1].trim(); if (!seededEmails.has(email)) problems.push(`${key}=${email} is not created by ${populationSeedPath}`);
}
const requiredSeedCommands = ["node scripts/seed-population-data.mjs seed","node scripts/seed-flow-data.mjs","node scripts/seed-public-site-content.mjs seed","node scripts/seed-playwright-records.mjs","node scripts/rebuild-public-leadership.mjs","node scripts/verify-test-population.mjs","node scripts/verify-flow-data.mjs"];
for (const command of requiredSeedCommands) if (!workflow.includes(command)) problems.push(`${workflowPath} must run ${command}`);
for (const command of ["node scripts/seed-test-data.mjs seed","node scripts/seed-e2e-auth-users.mjs seed"]) if (workflow.includes(command)) problems.push(`${workflowPath} must not run legacy overlapping seed ${command}`);

const forbiddenLegacyValues = ["test.admin@example.com","TEST_uid_admin_01","Orla Kelly","test.leader.parent@example.com","test.leader.only@example.com","test.leader.multisection@example.com"];
const e2eFiles = readdirSync("e2e").filter((name) => name.endsWith(".spec.ts"));
for (const name of e2eFiles) {
  const path = join("e2e", name); const content = readFileSync(path, "utf8");
  for (const value of forbiddenLegacyValues) if (content.includes(value)) problems.push(`${path} still references retired fixture value ${value}`);
  for (const match of content.matchAll(/login\(page,\s*"([^"]+@example\.com)"\)/g)) if (!seededEmails.has(match[1])) problems.push(`${path} logs in with account absent from the comprehensive population seed: ${match[1]}`);
}
for (const value of forbiddenLegacyValues) if (workflow.includes(value)) problems.push(`${workflowPath} still references retired fixture value ${value}`);
if (!seededEmails.has("test.webadmin@example.com")) problems.push("canonical website admin email is missing from population seed");
if (!seededUids.has("TEST_uid_web_admin_01")) problems.push("canonical website admin UID is missing from population seed");
if (!seededEmails.has("test.multi.section.leader@example.com")) problems.push("canonical multi-section leader is missing from population seed");
for (const token of ["status: \"closed\"","injuries:","plannedActivities:","plannedBadgework:","programmeNotes:"]) if (!weeklySeed.includes(token)) problems.push(`${weeklySeedPath} must seed canonical weekly lifecycle field ${token}`);
for (const section of ["Beavers","Cubs","Scouts","Ventures","Rovers"]) if (!weeklySeed.includes(`[\"${section}\"`)) problems.push(`${weeklySeedPath} must seed closed meeting history for ${section}`);
if (!weeklySeed.includes("two closed weekly meetings per section")) problems.push(`${weeklySeedPath} must document its deterministic two-meetings-per-section contract`);

if (problems.length) { console.error("Playwright seed contract failed:"); for (const problem of problems) console.error(`- ${problem}`); process.exit(1); }
console.log(`Playwright seed contract verified: ${seededEmails.size} canonical accounts, ${e2eFiles.length} specs, stable weekly lifecycle history for all sections.`);
