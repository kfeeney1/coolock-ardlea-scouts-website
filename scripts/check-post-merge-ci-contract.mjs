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

for (const [name, text] of [["Quality", quality], ["Playwright E2E", e2e], ["Firebase TEST Deploy", testDeploy]]) {
  requireMatch(text, /push:\s*\n\s*branches:\s*(?:\[main\]|\n\s*- main)/m, `${name} must run on pushes to main.`);
}

requireMatch(quality, /jobs:\s*\n\s*quality:/m, "Quality must publish the quality job/check.");
requireMatch(e2e, /jobs:\s*\n\s*e2e:/m, "Playwright E2E must publish the e2e job/check.");
requireMatch(testDeploy, /jobs:\s*\n\s*deploy_test:/m, "Firebase TEST Deploy must publish the deploy_test job/check.");

requireMatch(guard, /workflow_run:\s*\n\s*workflows:\s*\["Firebase TEST Deploy"\]/m, "Post-merge guard must react to TEST deployment completion.");
requireMatch(guard, /schedule:\s*\n\s*- cron:/m, "Post-merge guard must have a scheduled fallback for completely missing push workflows.");
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
