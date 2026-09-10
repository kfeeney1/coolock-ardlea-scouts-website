import { readdir, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const workflowDir = new URL(".github/workflows/", root);
const productionDeploySecret = "FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_PRODUCTION";
const productionOperationsSecret = "FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_PRODUCTION_OPERATIONS";
const productionAuditSecret = "FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_PRODUCTION_AUDIT";
const productionBackupSecret = "FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_PRODUCTION_BACKUP";
const testSecret = "FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_TEST";
const legacySecrets = [
  "FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
];
const productionDeployWorkflow = "firebase-hosting-merge.yml";
const forbiddenWorkflowScripts = ["scripts/purge-test-data.mjs"];
const productionCredentialPolicy = new Map([
  [productionDeploySecret, {
    workflows: new Set([productionDeployWorkflow]),
    requireProductionEnvironment: true,
    allowSchedule: false,
  }],
  [productionOperationsSecret, {
    workflows: new Set([
      "seed-production-equipment.yml",
      "rebuild-public-leadership.yml",
      "rebuild-parent-weekly-meetings.yml",
    ]),
    requireProductionEnvironment: true,
    allowSchedule: false,
  }],
  [productionAuditSecret, {
    workflows: new Set(["firestore-data-audit.yml"]),
    requireProductionEnvironment: true,
    allowSchedule: false,
  }],
  [productionBackupSecret, {
    workflows: new Set(["firestore-backup.yml", "firestore-backup-freshness.yml"]),
    requireProductionEnvironment: false,
    allowSchedule: true,
  }],
]);
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

function triggerBlock(source) {
  const start = source.indexOf("on:\n");
  const end = source.indexOf("\npermissions:", start);
  return start >= 0 && end > start ? source.slice(start, end) : "";
}

function hasPullRequestTrigger(source) {
  return /^on:\s*pull_request\b/m.test(source) || /^\s{2}pull_request:\s*$/m.test(source);
}

function hasPushTrigger(source) {
  return /^on:\s*push\b/m.test(source) || /^\s{2}push:\s*$/m.test(source);
}

function hasScheduleTrigger(source) {
  return /^on:\s*schedule\b/m.test(source) || /^\s{2}schedule:\s*$/m.test(source);
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
const productionCredentialUseCounts = new Map([...productionCredentialPolicy.keys()].map((secret) => [secret, 0]));
let testCredentialWorkflowCount = 0;
let pinnedInstallCount = 0;

for (const name of entries) {
  const source = await readFile(new URL(name, workflowDir), "utf8");
  const usesTestSecret = referencesSecret(source, testSecret);
  const pullRequestTriggered = hasPullRequestTrigger(source);
  const pushTriggered = hasPushTrigger(source);
  const scheduleTriggered = hasScheduleTrigger(source);

  for (const forbiddenScript of forbiddenWorkflowScripts) {
    if (source.includes(forbiddenScript)) {
      fail(`${name} must never invoke ${forbiddenScript} from GitHub Actions.`);
    }
  }

  for (const legacySecret of legacySecrets) {
    if (referencesSecret(source, legacySecret)) {
      fail(`${name} uses legacy unscoped Firebase credential ${legacySecret}.`);
    }
  }

  for (const [secret, policy] of productionCredentialPolicy) {
    if (!referencesSecret(source, secret)) continue;
    productionCredentialUseCounts.set(secret, productionCredentialUseCounts.get(secret) + 1);
    if (!policy.workflows.has(name)) {
      fail(`${name} references purpose-scoped production credential ${secret} outside its approved workflow set.`);
    }
    if (policy.requireProductionEnvironment && !source.includes("environment: production")) {
      fail(`${name} uses ${secret} without the protected production environment.`);
    }
    if (pullRequestTriggered || pushTriggered) {
      fail(`${name} exposes ${secret} to pull_request/push automation.`);
    }
    if (scheduleTriggered && !policy.allowSchedule) {
      fail(`${name} exposes ${secret} to scheduled automation.`);
    }
  }

  if (usesTestSecret) {
    testCredentialWorkflowCount += 1;
    if (source.includes("environment: production")) {
      fail(`${name} mixes the TEST Firebase credential with the production GitHub environment.`);
    }
  }

  if (pullRequestTriggered && source.includes("FIREBASE_SERVICE_ACCOUNT_JSON:") && !usesTestSecret) {
    fail(`${name} places a Firebase credential in a PR job without proving it is the TEST credential.`);
  }

  if (name === productionDeployWorkflow) {
    const triggers = triggerBlock(source);
    if (!triggers.includes("workflow_dispatch:")) fail("Production deploy workflow must use workflow_dispatch.");
    for (const forbidden of ["push:", "pull_request:", "schedule:", "release:", "workflow_run:"]) {
      if (triggers.includes(forbidden)) fail(`Production deploy workflow must not contain ${forbidden}`);
    }
  }

  for (const spec of explicitInstallSpecs(source)) {
    if (!packageSpecIsPinned(spec)) fail(`${name} installs an unpinned transient npm package: ${spec}`);
    else pinnedInstallCount += 1;
  }
}

for (const [secret, count] of productionCredentialUseCounts) {
  if (count < 1) fail(`Expected an approved workflow to reference purpose-scoped production credential ${secret}.`);
}
if (testCredentialWorkflowCount < 2) {
  fail("Expected TEST credentials to be scoped to both TEST deployment and TEST PR preview workflows.");
}

if (failures.length) {
  console.error(`\nWorkflow production-credential contract failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`Workflow credential-separation contract passed across ${entries.length} workflows.`);
console.log(`Verified ${productionCredentialPolicy.size} purpose-scoped production credential classes and ${testCredentialWorkflowCount} TEST credential workflow(s); verified ${pinnedInstallCount} transient npm package install(s).`);
