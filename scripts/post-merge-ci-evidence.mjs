import { pathToFileURL } from "node:url";

const workflowForCheck = {
  quality: "Quality",
  e2e: "Playwright E2E",
  deploy_test: "Firebase TEST Deploy"
};

export function unresolvedMissingChecks(requiredChecks, checkRuns, workflowRuns) {
  const publishedChecks = new Set(checkRuns.map((check) => check.name));
  const latestPushRuns = new Map();

  for (const run of workflowRuns) {
    if (run.event !== "push") continue;
    const current = latestPushRuns.get(run.name);
    if (!current || Number(run.id ?? 0) >= Number(current.id ?? 0)) latestPushRuns.set(run.name, run);
  }

  return requiredChecks.filter((checkName) => {
    if (publishedChecks.has(checkName)) return false;
    const workflowName = workflowForCheck[checkName];
    if (!workflowName) return true;
    const workflowRun = latestPushRuns.get(workflowName);
    return !workflowRun || workflowRun.status === "completed";
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const { requiredChecks, checkRuns, workflowRuns } = JSON.parse(input);
  const missing = unresolvedMissingChecks(requiredChecks, checkRuns, workflowRuns);
  process.stdout.write(missing.join(", ") + "\n");
}
