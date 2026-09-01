import { readdir, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const workflowsDirectory = new URL(".github/workflows/", root);
const failures = [];

const allowedWriteScopes = new Map([
  ["firebase-hosting-merge.yml", new Set(["checks"])],
]);

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

const workflowNames = (await readdir(workflowsDirectory))
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();

for (const name of workflowNames) {
  const source = await readFile(new URL(name, workflowsDirectory), "utf8");

  if (!/^\s*permissions\s*:/m.test(source)) {
    fail(`${name} does not declare explicit GitHub token permissions.`);
    continue;
  }

  if (/^\s*permissions\s*:\s*write-all\s*$/m.test(source)) {
    fail(`${name} grants write-all GitHub token permissions.`);
  }

  const allowed = allowedWriteScopes.get(name) ?? new Set();
  const writeScopePattern = /^\s+([a-z-]+)\s*:\s*write\s*$/gm;
  for (const match of source.matchAll(writeScopePattern)) {
    const scope = match[1];
    if (!allowed.has(scope)) {
      fail(`${name} grants unapproved ${scope}: write permission.`);
    }
  }
}

for (const [name, scopes] of allowedWriteScopes) {
  if (!workflowNames.includes(name)) {
    fail(`Write-permission allowlist references missing workflow ${name}.`);
    continue;
  }

  const source = await readFile(new URL(name, workflowsDirectory), "utf8");
  for (const scope of scopes) {
    const pattern = new RegExp(`^\\s+${scope.replaceAll("-", "\\-")}\\s*:\\s*write\\s*$`, "m");
    if (!pattern.test(source)) {
      fail(`${name} no longer uses allowlisted ${scope}: write permission; remove the stale exception.`);
    }
  }
}

if (failures.length) {
  console.error(`\nWorkflow permission contract failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`Workflow permission contract passed for ${workflowNames.length} workflow(s).`);
