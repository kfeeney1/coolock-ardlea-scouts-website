import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const REQUIRED_WORKFLOWS = ["Quality", "Playwright E2E", "Firebase TEST Deploy"];
export const REQUIRED_CHECKS = ["quality", "e2e", "deploy_test"];

const workflowForCheck = {
  quality: "Quality",
  e2e: "Playwright E2E",
  deploy_test: "Firebase TEST Deploy"
};
const pendingStates = new Set(["missing", "queued", "in_progress", "waiting", "requested", "pending"]);

function latestById(items) {
  return [...items].sort((left, right) => Number(left.id ?? 0) - Number(right.id ?? 0)).at(-1);
}

function stateOf(item) {
  if (!item) return "missing";
  return item.status === "completed" ? item.conclusion ?? "missing-conclusion" : item.status ?? "missing-status";
}

export function evaluatePostMergeEvidence(targetSha, requiredWorkflows, requiredChecks, checkRuns, workflowRuns) {
  const exactPushRuns = workflowRuns.filter((run) => run.event === "push" && run.head_sha === targetSha);
  const exactChecks = checkRuns.filter((check) => check.head_sha === targetSha);
  const workflows = Object.fromEntries(requiredWorkflows.map((name) => [
    name,
    stateOf(latestById(exactPushRuns.filter((run) => run.name === name)))
  ]));
  const checks = Object.fromEntries(requiredChecks.map((name) => [
    name,
    stateOf(latestById(exactChecks.filter((check) => check.name === name)))
  ]));

  const failed = [];
  for (const [name, state] of Object.entries(workflows)) {
    if (!pendingStates.has(state) && state !== "success") failed.push(`workflow ${name}=${state}`);
  }
  for (const [name, state] of Object.entries(checks)) {
    if (!pendingStates.has(state) && state !== "success") failed.push(`check ${name}=${state}`);
  }

  const waiting = [];
  for (const [name, state] of Object.entries(workflows)) {
    if (pendingStates.has(state)) waiting.push(`workflow ${name}=${state}`);
  }
  for (const [name, state] of Object.entries(checks)) {
    if (pendingStates.has(state)) waiting.push(`check ${name}=${state}`);
  }

  return { workflows, checks, failed, waiting, passed: failed.length === 0 && waiting.length === 0 };
}

function diagnostics(targetSha, elapsedMs, result) {
  const states = [
    ...Object.entries(result.workflows).map(([name, state]) => `workflow ${name}=${state}`),
    ...Object.entries(result.checks).map(([name, state]) => `check ${name}=${state}`)
  ].join("; ");
  return `Post-merge CI evidence for ${targetSha} after ${Math.floor(elapsedMs / 1000)}s: ${states}`;
}

export async function waitForPostMergeEvidence({
  targetSha,
  requiredWorkflows = REQUIRED_WORKFLOWS,
  requiredChecks = REQUIRED_CHECKS,
  fetchSnapshot,
  timeoutMs,
  missingGraceMs,
  pollIntervalMs,
  now = () => Date.now(),
  sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
  log = () => {}
}) {
  const startedAt = now();
  const deadline = startedAt + timeoutMs;
  const missingDeadline = startedAt + missingGraceMs;
  let lastResult;

  while (now() <= deadline) {
    let snapshot;
    try {
      snapshot = await fetchSnapshot(targetSha);
    } catch (error) {
      throw new Error(`Could not fetch post-merge CI evidence for ${targetSha} after ${Math.floor((now() - startedAt) / 1000)}s: ${error.message}`);
    }
    lastResult = evaluatePostMergeEvidence(targetSha, requiredWorkflows, requiredChecks, snapshot.checkRuns, snapshot.workflowRuns);
    const elapsedMs = now() - startedAt;
    log(diagnostics(targetSha, elapsedMs, lastResult));

    if (now() > deadline) {
      const budget = timeoutMs % 60_000 === 0 ? `${timeoutMs / 60_000}m` : `${timeoutMs / 1000}s`;
      throw new Error(`${diagnostics(targetSha, elapsedMs, lastResult)}. Timed out after the bounded ${budget} wait; the final poll completed after the deadline.`);
    }
    if (lastResult.failed.length) {
      throw new Error(`${diagnostics(targetSha, elapsedMs, lastResult)}. Rejected: ${lastResult.failed.join(", ")}.`);
    }
    if (lastResult.passed) {
      log(`All required post-merge workflows and exact-SHA checks succeeded for ${targetSha}.`);
      return lastResult;
    }
    if (now() >= missingDeadline) {
      const neverStarted = lastResult.waiting.filter((state) => {
        if (!state.endsWith("=missing")) return false;
        if (state.startsWith("workflow ")) return true;
        const checkName = state.split(" ")[1].split("=")[0];
        const sourceState = lastResult.workflows[workflowForCheck[checkName]];
        return !pendingStates.has(sourceState);
      });
      if (neverStarted.length) {
        const completedSourceChecks = neverStarted.filter((state) => {
          const checkName = state.split(" ")[1].split("=")[0];
          return lastResult.workflows[workflowForCheck[checkName]] === "success";
        });
        const neverStartedWork = neverStarted.filter((state) => !completedSourceChecks.includes(state));
        const details = [
          neverStartedWork.length ? `Required evidence never appeared within the ${Math.floor(missingGraceMs / 1000)}s startup grace: ${neverStartedWork.join(", ")}` : "",
          completedSourceChecks.length ? `Required exact-SHA checks never appeared after their workflows completed: ${completedSourceChecks.join(", ")}` : ""
        ].filter(Boolean).join(". ");
        throw new Error(`${diagnostics(targetSha, elapsedMs, lastResult)}. ${details}.`);
      }
    }
    if (now() >= deadline) break;
    await sleep(Math.min(pollIntervalMs, deadline - now()));
  }

  const elapsedMs = now() - startedAt;
  const budget = timeoutMs % 60_000 === 0 ? `${timeoutMs / 60_000}m` : `${timeoutMs / 1000}s`;
  throw new Error(`${diagnostics(targetSha, elapsedMs, lastResult ?? { workflows: {}, checks: {} })}. Timed out after the bounded ${budget} wait; unresolved: ${(lastResult?.waiting ?? []).join(", ") || "no successful evidence"}.`);
}

function ghJson(endpoint) {
  return JSON.parse(execFileSync("gh", ["api", endpoint], { encoding: "utf8", timeout: 30_000 }));
}

async function main() {
  const options = {};
  for (let index = 2; index < process.argv.length; index += 1) {
    const [key, inlineValue] = process.argv[index].replace(/^--/, "").split("=", 2);
    if (inlineValue !== undefined) options[key] = inlineValue;
    else if (key === "wait") options.wait = "true";
    else options[key] = process.argv[++index];
  }
  const targetSha = process.env.TARGET_SHA;
  const repository = process.env.GITHUB_REPOSITORY;
  if (options.wait !== "true") throw new Error("Use --wait.");
  if (!targetSha || !repository) throw new Error("TARGET_SHA and GITHUB_REPOSITORY are required.");
  const timeoutMs = Number(options["timeout-seconds"] ?? 1800) * 1000;
  const missingGraceMs = Number(options["missing-grace-seconds"] ?? 180) * 1000;
  const pollIntervalMs = Number(options["poll-interval-seconds"] ?? 30) * 1000;
  if (![timeoutMs, missingGraceMs, pollIntervalMs].every(Number.isFinite) || timeoutMs <= 0 || missingGraceMs < 0 || pollIntervalMs <= 0) {
    throw new Error("Timeout, missing grace, and poll interval must be valid bounded numbers.");
  }

  await waitForPostMergeEvidence({
    targetSha,
    timeoutMs,
    missingGraceMs,
    pollIntervalMs,
    fetchSnapshot: async (sha) => {
      const [runs, checks] = await Promise.all([
        ghJson(`repos/${repository}/actions/runs?head_sha=${sha}&per_page=100`),
        ghJson(`repos/${repository}/commits/${sha}/check-runs?per_page=100`)
      ]);
      return { workflowRuns: runs.workflow_runs ?? [], checkRuns: checks.check_runs ?? [] };
    },
    log: (message) => console.log(message)
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--wait")) {
    main().catch((error) => {
      console.error(`::error::${error.message}`);
      process.exitCode = 1;
    });
  }
}
