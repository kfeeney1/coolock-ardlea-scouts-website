import { readdir, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const workflowDir = new URL(".github/workflows/", root);
const productionSecret = "FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_PRODUCTION";
const testSecret = "FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_TEST";
const legacySecrets = [
  "FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
];
const productionWorkflow = "firebase-hosting-merge.yml";
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

function hasPullRequestTrigger(source) {
  return /^on:\s*pull_request\b/m.test(source) || /^\s{2}pull_request:\s*$/m.test(source);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function referencesSecret(source, secretName) {
  return new RegExp(`secrets\\.${escapeRegex(secretName)}(?![A-Z0-9_])`).test(source);
}

function packageSpecIsPinned(spec) {
  if (spec.startsWith("@")) {
    return /^@[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+@\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(spec);
  }
  return /^[A-Za-z0-9._-]+@\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(spec);
}

function explicitInstallSpecs(source) {
  const specs = [];
  for (const line of source.split("\n")) {
    const marker = "npm install ";
    const offset = line.indexOf(marker);
    if (offset === -1) continue;
    const command = line.slice(offset + marker.length).trim();
    for (const token of command.split(/\s+/)) {
      if (!token || token.startsWith("-")) continue;
      specs.push(token.replace(/["']/g, ""));
    }
  }
  return specs;
}

const entries = (await readdir(workflowDir)).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml")).sort();
let productionCredentialWorkflowCount = 0;
let testCredentialWorkflowCount = 0;
let pinnedInstallCount = 0;

for (const name of entries) {
  const source = await readFile(new URL(name, workflowDir), "utf8");
  const usesProductionSecret = referencesSecret(source, productionSecret);
  const usesTestSecret = referencesSecret(source, testSecret);
  const pullRequestTriggered = hasPullRequestTrigger(source);

  for (const legacySecret of legacySecrets) {
    if (referencesSecret(source, legacySecret)) {
      fail(`${name} uses legacy unscoped Firebase credential ${legacySecret}.`);
    }
  }

  if (usesProductionSecret) {
    productionCredentialWorkflowCount += 1;
    if (name !== productionWorkflow) {
      fail(`${name} references the production Firebase credential outside the manual production workflow.`);
    }
    if (pullRequestTriggered) {
      fail(`${name} exposes the production Firebase credential to a pull_request trigger.`);
    }
  }

  if (usesTestSecret) testCredentialWorkflowCount += 1;

  if (pullRequestTriggered && source.includes("FIREBASE_SERVICE_ACCOUNT_JSON:") && !usesTestSecret) {
    fail(`${name} places a Firebase credential in a PR job without proving it is the TEST credential.`);
  }

  for (const spec of explicitInstallSpecs(source)) {
    if (!packageSpecIsPinned(spec)) fail(`${name} installs an unpinned transient npm package: ${spec}`);
    else pinnedInstallCount += 1;
  }
}

if (productionCredentialWorkflowCount !== 1) {
  fail(`Expected exactly one production credential workflow; found ${productionCredentialWorkflowCount}.`);
}
if (testCredentialWorkflowCount < 2) {
  fail("Expected TEST credentials to be scoped to both TEST deployment and TEST PR preview workflows.");
}

if (failures.length) {
  console.error(`\nWorkflow production-credential contract failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`Workflow credential-separation contract passed across ${entries.length} workflows.`);
console.log(`Protected ${productionCredentialWorkflowCount} production and ${testCredentialWorkflowCount} TEST credential workflow(s); verified ${pinnedInstallCount} transient npm package install(s).`);
