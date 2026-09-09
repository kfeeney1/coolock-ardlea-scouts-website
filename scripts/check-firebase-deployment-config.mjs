import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const productionWorkflow = await readFile(new URL(".github/workflows/firebase-hosting-merge.yml", root), "utf8");
const testWorkflow = await readFile(new URL(".github/workflows/firebase-hosting-test.yml", root), "utf8");
const previewWorkflow = await readFile(new URL(".github/workflows/firebase-hosting-pull-request.yml", root), "utf8");
const productionSmokeWorkflow = await readFile(new URL(".github/workflows/post-deploy-smoke.yml", root), "utf8");
const playwrightWorkflow = await readFile(new URL(".github/workflows/playwright-e2e.yml", root), "utf8");
const firebaseRc = JSON.parse(await readFile(new URL(".firebaserc", root), "utf8"));
const firebase = JSON.parse(await readFile(new URL("firebase.json", root), "utf8"));

const PROD = "coolock-ardlea-scouts";
const TEST = "coolock-ardlea-scouts-test";
const LOCAL = "demo-coolock-ardlea-scouts";
const failures = [];

function requireContract(condition, message) {
  if (condition) console.log(`PASS: ${message}`);
  else {
    failures.push(message);
    console.error(`FAIL: ${message}`);
  }
}

function triggerBlock(workflow) {
  const start = workflow.indexOf("on:\n");
  const end = workflow.indexOf("\npermissions:", start);
  return start >= 0 && end > start ? workflow.slice(start, end) : "";
}

requireContract(firebase?.firestore?.rules === "firestore.rules", "firebase.json declares Firestore rules.");
requireContract(firebase?.firestore?.indexes === "firestore.indexes.json", "firebase.json declares Firestore indexes.");
requireContract(firebase?.storage?.rules === "storage.rules", "firebase.json declares Storage rules.");

requireContract(firebaseRc?.projects?.test === TEST, "Firebase TEST alias targets the isolated TEST project.");
requireContract(firebaseRc?.projects?.production === PROD, "Firebase PRODUCTION alias targets the authoritative production project.");
requireContract(firebaseRc?.projects?.default === TEST, "The default Firebase CLI alias is non-production.");

const productionTriggers = triggerBlock(productionWorkflow);
requireContract(productionTriggers.includes("workflow_dispatch:"), "Production deployment is explicitly manually dispatched.");
for (const forbidden of ["push:", "pull_request:", "schedule:", "release:", "workflow_run:"]) {
  requireContract(!productionTriggers.includes(forbidden), `Production deployment is not triggered by ${forbidden.replace(":", "")}.`);
}
requireContract(productionWorkflow.includes("environment: production"), "Production deploy targets the protected production GitHub environment.");
requireContract(productionWorkflow.includes("FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_PRODUCTION"), "Production uses a production-scoped credential name.");
requireContract(productionWorkflow.includes("git merge-base --is-ancestor"), "Production verifies the requested SHA is contained in current main.");
requireContract(productionWorkflow.includes("production_project_id"), "Production requires exact project-ID confirmation.");
requireContract(productionWorkflow.includes("tests/firestore/*.test.mjs"), "Production reruns Firestore Rules tests on emulators before deployment.");
requireContract(productionWorkflow.includes("tests/storage/*.test.mjs"), "Production reruns Storage Rules tests on emulators before deployment.");
requireContract(productionWorkflow.includes("smoke:live"), "Production performs a read-only post-deployment smoke check.");
requireContract(productionWorkflow.includes("EXPECTED_BUILD_SHA: ${{ inputs.commit_sha }}"), "Production verifies the exact deployed release SHA.");
requireContract(!productionWorkflow.includes("continue-on-error: true"), "Production deployment fails closed.");

const smokeTriggers = triggerBlock(productionSmokeWorkflow);
requireContract(smokeTriggers.includes("workflow_dispatch:"), "Standalone production smoke is manual-only.");
for (const forbidden of ["push:", "pull_request:", "schedule:", "release:", "workflow_run:"]) {
  requireContract(!smokeTriggers.includes(forbidden), `Production smoke is not automatically triggered by ${forbidden.replace(":", "")}.`);
}
requireContract(productionSmokeWorkflow.includes("environment: production"), "Standalone production smoke uses the production GitHub environment.");

requireContract(testWorkflow.includes("push:\n    branches:\n      - main"), "TEST deploys from main only.");
requireContract(testWorkflow.includes("environment: test"), "TEST deployment uses the test GitHub environment.");
requireContract(testWorkflow.includes(`FIREBASE_PROJECT_ID: ${TEST}`), "TEST deployment explicitly targets the TEST Firebase project.");
requireContract(!testWorkflow.includes(PROD), "TEST deployment workflow contains no production project ID.");
requireContract(testWorkflow.includes("firestore:rules,firestore:indexes,storage,hosting"), "TEST deploys reviewed Rules, indexes, Storage rules and Hosting together.");
requireContract(testWorkflow.includes("validate-firebase-environment.mjs"), "TEST validates its project and credential before deployment.");
requireContract(testWorkflow.includes("smoke:live"), "TEST runs the same read-only public boundary smoke contract.");

requireContract(previewWorkflow.includes("environment: test"), "PR previews use the test GitHub environment.");
requireContract(previewWorkflow.includes(`projectId: ${TEST}`), "PR previews target the TEST Firebase project.");
requireContract(!previewWorkflow.includes(PROD), "PR preview workflow contains no production project ID.");
requireContract(!previewWorkflow.includes("COOLOCK_ARDLEA_SCOUTS_PRODUCTION"), "PR previews cannot reference production credentials.");

requireContract(playwrightWorkflow.includes(`VITE_FIREBASE_PROJECT_ID: ${LOCAL}`), "Normal Playwright CI uses an emulator-only Firebase project ID.");
requireContract(!playwrightWorkflow.includes("secrets.VITE_FIREBASE_"), "Normal Playwright CI receives no Firebase repository secrets.");
requireContract(!playwrightWorkflow.includes("secrets.VITE_EMAIL_API_URL"), "Normal Playwright CI receives no production email endpoint secret.");
requireContract(!playwrightWorkflow.includes(PROD), "Normal Playwright CI contains no production Firebase project ID.");

if (failures.length > 0) {
  console.error(`\nFirebase deployment configuration check failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log("\nFirebase deployment configuration check passed.");
