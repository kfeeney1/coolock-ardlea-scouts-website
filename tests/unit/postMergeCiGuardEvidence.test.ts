import assert from "node:assert/strict";
import test from "node:test";
import PlaywrightAssuranceReporter from "../../scripts/playwright-assurance-reporter.mjs";
import { evaluatePostMergeEvidence, waitForPostMergeEvidence } from "../../scripts/post-merge-ci-evidence.mjs";

const sha = "merge-sha-123";
const requiredWorkflows = ["Quality", "Playwright E2E", "Firebase TEST Deploy"];
const requiredChecks = ["quality", "e2e", "deploy_test"];

function passingEvidence() {
  return {
    workflowRuns: requiredWorkflows.map((name, index) => ({ id: index + 1, event: "push", head_sha: sha, name, status: "completed", conclusion: "success" })),
    checkRuns: requiredChecks.map((name, index) => ({ id: index + 1, head_sha: sha, name, status: "completed", conclusion: "success" }))
  };
}

function fakeClock() {
  let time = 0;
  return {
    now: () => time,
    sleep: async (duration) => { time += duration; }
  };
}

test("slow required Playwright workflow passes when it finishes within the 30-minute budget", async () => {
  const clock = fakeClock();
  let polls = 0;
  const result = await waitForPostMergeEvidence({
    targetSha: sha,
    requiredWorkflows,
    requiredChecks,
    timeoutMs: 30 * 60_000,
    missingGraceMs: 3 * 60_000,
    pollIntervalMs: 60_000,
    now: clock.now,
    sleep: clock.sleep,
    fetchSnapshot: async () => {
      polls += 1;
      if (polls < 19) {
        const evidence = passingEvidence();
        evidence.workflowRuns[1] = { ...evidence.workflowRuns[1], status: "in_progress", conclusion: null };
        evidence.checkRuns = evidence.checkRuns.filter((check) => check.name !== "e2e");
        return evidence;
      }
      return passingEvidence();
    }
  });
  assert.equal(result.passed, true);
  assert.equal(clock.now(), 18 * 60_000);
});

test("a failed required workflow is rejected immediately", async () => {
  const evidence = passingEvidence();
  evidence.workflowRuns[1] = { ...evidence.workflowRuns[1], status: "completed", conclusion: "failure" };
  await assert.rejects(
    waitForPostMergeEvidence({ targetSha: sha, requiredWorkflows, requiredChecks, timeoutMs: 60_000, missingGraceMs: 5_000, pollIntervalMs: 1_000, fetchSnapshot: async () => evidence }),
    /workflow Playwright E2E=failure/
  );
});

test("an incomplete required workflow fails at the bounded deadline with actionable state", async () => {
  const clock = fakeClock();
  const evidence = passingEvidence();
  evidence.workflowRuns[1] = { ...evidence.workflowRuns[1], status: "in_progress", conclusion: null };
  evidence.checkRuns[1] = { ...evidence.checkRuns[1], status: "in_progress", conclusion: null };
  await assert.rejects(
    waitForPostMergeEvidence({ targetSha: sha, requiredWorkflows, requiredChecks, timeoutMs: 10_000, missingGraceMs: 5_000, pollIntervalMs: 4_000, now: clock.now, sleep: clock.sleep, fetchSnapshot: async () => evidence }),
    new RegExp(`${sha} after 10s:.*Playwright E2E=in_progress.*e2e=in_progress.*Timed out after the bounded 10s wait`)
  );
});

test("required evidence still missing after its startup grace fails with the exact missing names", async () => {
  const clock = fakeClock();
  const result = { workflowRuns: [], checkRuns: [] };
  await assert.rejects(
    waitForPostMergeEvidence({ targetSha: sha, requiredWorkflows, requiredChecks, timeoutMs: 30_000, missingGraceMs: 5_000, pollIntervalMs: 5_000, now: clock.now, sleep: clock.sleep, fetchSnapshot: async () => result }),
    new RegExp(`${sha} after 5s:.*workflow Quality=missing.*quality=missing.*never appeared within the 5s startup grace`)
  );
});

test("required workflow and check results from a different SHA cannot satisfy the guard", () => {
  const evidence = passingEvidence();
  evidence.workflowRuns.forEach((run) => { run.head_sha = "other-sha"; });
  evidence.checkRuns.forEach((run) => { run.head_sha = "other-sha"; });
  const result = evaluatePostMergeEvidence(sha, requiredWorkflows, requiredChecks, evidence.checkRuns, evidence.workflowRuns);
  assert.equal(result.passed, false);
  assert.deepEqual(result.waiting, [
    "workflow Quality=missing", "workflow Playwright E2E=missing", "workflow Firebase TEST Deploy=missing",
    "check quality=missing", "check e2e=missing", "check deploy_test=missing"
  ]);
});

test("a Playwright retry-only pass remains a failed assurance result", () => {
  const reporter = new PlaywrightAssuranceReporter();
  reporter.onTestEnd({
    outcome: () => "flaky",
    titlePath: () => ["retry-only regression"],
    parent: { project: () => ({ name: "Chromium" }) }
  }, { status: "passed" });
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    assert.deepEqual(reporter.onEnd(), { status: "failed" });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  assert.equal(reporter.counts.flaky, 1);
});
