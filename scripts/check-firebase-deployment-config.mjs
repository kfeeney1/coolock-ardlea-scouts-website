import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const mergeWorkflow = await readFile(new URL(".github/workflows/firebase-hosting-merge.yml", root), "utf8");
const rulesWorkflow = await readFile(new URL(".github/workflows/firestore-rules.yml", root), "utf8");
const smokeWorkflow = await readFile(new URL(".github/workflows/post-deploy-smoke.yml", root), "utf8");
const firebase = JSON.parse(await readFile(new URL("firebase.json", root), "utf8"));

const failures = [];
function requireContract(condition, message) {
  if (condition) console.log(`PASS: ${message}`);
  else {
    failures.push(message);
    console.error(`FAIL: ${message}`);
  }
}

requireContract(firebase?.firestore?.rules === "firestore.rules", "firebase.json declares Firestore rules.");
requireContract(firebase?.firestore?.indexes === "firestore.indexes.json", "firebase.json declares Firestore indexes.");
requireContract(firebase?.storage?.rules === "storage.rules", "firebase.json declares Storage rules.");

const firestoreDeploy = "deploy --only firestore:rules,firestore:indexes --project coolock-ardlea-scouts --non-interactive";
const storageDeploy = "deploy --only storage --project coolock-ardlea-scouts --non-interactive";
requireContract(mergeWorkflow.includes(firestoreDeploy), "The live workflow deploys Firestore rules and indexes before Hosting.");
requireContract(mergeWorkflow.includes(storageDeploy), "The live workflow has a strict Storage rules deployment when the capability is enabled.");
requireContract(mergeWorkflow.includes("vars.FIREBASE_STORAGE_ENABLED == 'true'"), "Storage deployment is controlled by an explicit production capability flag.");
requireContract(mergeWorkflow.includes("vars.FIREBASE_STORAGE_ENABLED != 'true'"), "Disabled Storage is reported explicitly rather than failing silently.");
requireContract(!mergeWorkflow.includes("continue-on-error: true"), "The live Firebase configuration deployment fails closed.");
requireContract(!rulesWorkflow.includes("firebase deploy"), "The rules workflow tests rules without racing the authoritative live deployment.");
requireContract(smokeWorkflow.includes("FIREBASE_STORAGE_BUCKET:"), "The post-deploy smoke workflow supplies the Storage bucket.");
requireContract(smokeWorkflow.includes("FIREBASE_STORAGE_ENABLED:"), "The post-deploy smoke workflow uses the Storage capability flag.");
requireContract(smokeWorkflow.includes("Verify live site and Firebase services"), "The post-deploy gate covers the combined Firebase service check.");

if (failures.length > 0) {
  console.error(`\nFirebase deployment configuration check failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log("\nFirebase deployment configuration check passed.");
