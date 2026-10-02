import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const failures = [];

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

function requireMatch(text, pattern, message) {
  if (!pattern.test(text)) failures.push(message);
}

const quality = await source(".github/workflows/quality.yml");
const e2e = await source(".github/workflows/playwright-e2e.yml");
const testDeploy = await source(".github/workflows/firebase-hosting-test.yml");
const production = await source(".github/workflows/firebase-hosting-merge.yml");
const guard = await source(".github/workflows/post-merge-ci-guard.yml");
const guardEvidence = await source("scripts/post-merge-ci-evidence.mjs");

for (const [name, text] of [["Quality", quality], ["Playwright E2E", e2e], ["Firebase TEST Deploy", testDeploy]]) {
  requireMatch(text, /push:\s*\n\s*branches:\s*(?:\[main\]|\n\s*- main)/m, `${name} must run on pushes to main.`);
}

requireMatch(quality, /jobs:\s*\n\s*quality:/m, "Quality must publish the quality job/check.");
requireMatch(e2e, /^  e2e:\s*$/m, "Playwright E2E must publish the e2e job/check.");
requireMatch(e2e, /e2e_shard:[\s\S]*shard:\s*1\/2[\s\S]*shard:\s*2\/2/m, "Playwright E2E must retain two isolated execution shards.");
requireMatch(e2e, /e2e:\s*\n\s*if:[\s\S]*needs:\s*e2e_shard/m, "The protected e2e check must aggregate the Playwright shards.");
requireMatch(e2e, /test:e2e:full -- --shard/, "Full main E2E must execute through the shard-aware full-suite command.");
requireMatch(e2e, /test:e2e:pr -- --base[\s\S]*--shard/, "PR E2E must preserve affected-suite selection inside each shard.");
requireMatch(testDeploy, /jobs:\s*\n\s*deploy_test:/m, "Firebase TEST Deploy must publish the deploy_test job/check.");

requireMatch(guard, /push:\s*\n\s*branches:\s*(?:\[main\]|\n\s*- main)/m, "Post-merge guard must start directly on pushes to main.");
requireMatch(guard, /workflow_run:\s*\n\s*workflows:\s*\["Firebase TEST Deploy"\]/m, "Post-merge guard must also react to TEST deployment completion.");
requireMatch(guard, /GITHUB_EVENT_NAME.*push[\s\S]*TARGET_SHA="\$\{GITHUB_SHA\}"/m, "Post-merge guard must bind a push-triggered run to the exact pushed SHA.");
requireMatch(guard, /schedule:\s*\n\s*- cron:/m, "Post-merge guard must have a scheduled fallback for completely missing push workflows.");
requireMatch(guard, /actions\/checkout@[0-9a-f]{40}[\s\S]*?ref:\s*\$\{\{\s*steps\.target\.outputs\.sha\s*\}\}[\s\S]*?node scripts\/post-merge-ci-evidence\.mjs/m, "Guard must resolve missing exact-SHA checks from the guarded revision.");
requireMatch(guardEvidence, /run\.status === "completed"/, "A missing exact-SHA check must become a failure after its source workflow completes.");

for (const expected of ["Quality", "Playwright E2E", "Firebase TEST Deploy", "quality", "e2e", "deploy_test"]) {
  if (!guard.includes(`"${expected}"`)) failures.push(`Post-merge guard does not require ${expected}.`);
}

requireMatch(production, /required_check in 'quality' 'e2e'/m, "Production deployment must wait for exact-SHA quality and e2e checks.");
requireMatch(production, /commits\/\$\{TARGET_SHA\}\/check-runs/m, "Production deployment must query checks for the exact release SHA.");

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  console.error(`\nPost-merge CI contract failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log("Post-merge CI contract passed.");
