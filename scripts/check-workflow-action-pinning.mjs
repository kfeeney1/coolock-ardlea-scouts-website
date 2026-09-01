import { readdir, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const workflowsDirectory = new URL(".github/workflows/", root);
const failures = [];
const actionPattern = /^\s*-?\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/gm;
const immutableRefPattern = /^[0-9a-f]{40}$/i;

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

const workflowNames = (await readdir(workflowsDirectory))
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();

let externalActionCount = 0;

for (const name of workflowNames) {
  const source = await readFile(new URL(name, workflowsDirectory), "utf8");

  for (const match of source.matchAll(actionPattern)) {
    const action = match[1];
    if (action.startsWith("./")) continue;

    externalActionCount += 1;
    const at = action.lastIndexOf("@");
    if (at <= 0 || at === action.length - 1) {
      fail(`${name} uses external action without an explicit ref: ${action}`);
      continue;
    }

    const ref = action.slice(at + 1);
    if (!immutableRefPattern.test(ref)) {
      fail(`${name} uses mutable action ref ${action}; pin external actions to a full 40-character commit SHA.`);
    }
  }
}

if (externalActionCount === 0) {
  fail("No external GitHub Actions were found; review the pinning contract if workflow structure changed.");
}

if (failures.length) {
  console.error(`\nWorkflow action pinning contract failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`Workflow action pinning contract passed for ${externalActionCount} external action use(s) across ${workflowNames.length} workflow(s).`);
