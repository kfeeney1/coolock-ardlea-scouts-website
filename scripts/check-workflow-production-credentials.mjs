import { readdir, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const workflowDir = new URL(".github/workflows/", root);
const canonicalSecret = "FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS";
const legacySecret = "FIREBASE_SERVICE_ACCOUNT_JSON";
const previewWorkflow = "firebase-hosting-pull-request.yml";
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

function hasPullRequestTrigger(source) {
  return /^on:\s*pull_request\b/m.test(source) || /^\s{2}pull_request:\s*$/m.test(source);
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
let credentialWorkflowCount = 0;
let pinnedInstallCount = 0;

for (const name of entries) {
  const source = await readFile(new URL(name, workflowDir), "utf8");
  const usesCanonicalSecret = source.includes(`secrets.${canonicalSecret}`);
  const usesLegacySecret = source.includes(`secrets.${legacySecret}`);
  const pullRequestTriggered = hasPullRequestTrigger(source);

  if (usesLegacySecret) {
    fail(`${name} uses the legacy Firebase service-account secret name; use ${canonicalSecret}.`);
  }

  if (usesCanonicalSecret) {
    credentialWorkflowCount += 1;
  }

  if (pullRequestTriggered && source.includes("FIREBASE_SERVICE_ACCOUNT_JSON:")) {
    fail(`${name} exposes a production Firebase service account to repository code on a pull_request trigger.`);
  }

  if (pullRequestTriggered && usesCanonicalSecret) {
    if (name !== previewWorkflow) {
      fail(`${name} is pull_request-triggered while using the production Firebase service account.`);
    } else {
      if (!source.includes("github.event.pull_request.head.repo.full_name == github.repository")) {
        fail(`${name} must retain its same-repository PR guard before using preview credentials.`);
      }
      if (!source.includes(`firebaseServiceAccount: \${{ secrets.${canonicalSecret} }}`)) {
        fail(`${name} may use the production service account only through the pinned Firebase Hosting preview action input.`);
      }
    }
  }

  for (const spec of explicitInstallSpecs(source)) {
    if (!packageSpecIsPinned(spec)) {
      fail(`${name} installs an unpinned transient npm package: ${spec}`);
    } else {
      pinnedInstallCount += 1;
    }
  }
}

if (credentialWorkflowCount === 0) {
  fail("No production Firebase credential workflows were found; the guard would no longer protect a meaningful surface.");
}

if (failures.length) {
  console.error(`\nWorkflow production-credential contract failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`Workflow production-credential contract passed across ${entries.length} workflows.`);
console.log(`Protected ${credentialWorkflowCount} credential-bearing workflow(s) and verified ${pinnedInstallCount} transient npm package install(s).`);
