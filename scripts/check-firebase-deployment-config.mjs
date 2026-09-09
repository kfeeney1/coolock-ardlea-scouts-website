import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const productionWorkflow = await readFile(new URL(".github/workflows/firebase-hosting-merge.yml", root), "utf8");
const testWorkflow = await readFile(new URL(".github/workflows/firebase-hosting-test.yml", root), "utf8");
const previewWorkflow = await readFile(new URL(".github/workflows/firebase-hosting-pull-request.yml", root), "utf8");
const firebaseRc = JSON.parse(await readFile(new URL(".firebaserc", root), "utf8"));
const firebase = JSON.parse(await readFile(new URL("firebase.json", root), "utf8"));

const PROD = "coolock-ardlea-scouts";
const TEST = "coolock-ardlea-scouts-test";
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
requireContract(productionWorkflow.includes("test:rules"), "Production reruns Firebase Rules tests before deployment.");
requireContract(productionWorkflow.includes("test:e2e:prod"), "Production runs the read-only production Playwright smoke suite after deployment.");
requireContract(!productionWorkflow.includes("continue-on-error: true"), "Production deployment fails closed.");

requireContract(testWorkflow.includes("push:\n    branches:\n      - main"), "TEST deploys from main only.");
requireContract(testWorkflow.includes("environment: test"), "TEST deployment uses the test GitHub environment.");
requireContract(testWorkflow.includes(`FIREBASE_PROJECT_ID: ${TEST}`), "TEST deployment explicitly targets the TEST Firebase project.");
requireContract(!testWorkflow.includes(PROD), "TEST deployment workflow contains no production project ID.");
requireContract(testWorkflow.includes("firestore:rules,firestore:indexes,storage,hosting"), "TEST deploys reviewed Rules, indexes, Storage rules and Hosting together.");
requireContract(testWorkflow.includes("validate-firebase-environment.mjs"), "TEST validates its project and credential before deployment.");

requireContract(previewWorkflow.includes("environment: test"), "PR previews use the test GitHub environment.");
requireContract(previewWorkflow.includes(`projectId: ${TEST}`), "PR previews target the TEST Firebase project.");
requireContract(!previewWorkflow.includes(PROD), "PR preview workflow contains no production project ID.");
requireContract(!previewWorkflow.includes("COOLOCK_ARDLEA_SCOUTS_PRODUCTION"), "PR previews cannot reference production credentials.");

if (failures.length > 0) {
  console.error(`\nFirebase deployment configuration check failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log("\nFirebase deployment configuration check passed.");
