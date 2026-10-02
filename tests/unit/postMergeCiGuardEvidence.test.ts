import assert from "node:assert/strict";
import test from "node:test";
import { unresolvedMissingChecks } from "../../scripts/post-merge-ci-evidence.mjs";

const requiredChecks = ["quality", "e2e", "deploy_test"];

test("missing aggregate e2e stays pending while its exact-SHA workflow is running", () => {
  const checks = [{ name: "quality" }, { name: "deploy_test" }];
  const workflows = [
    { id: 1, event: "push", name: "Quality", status: "completed" },
    { id: 2, event: "push", name: "Playwright E2E", status: "in_progress" },
    { id: 3, event: "push", name: "Firebase TEST Deploy", status: "completed" }
  ];
  assert.deepEqual(unresolvedMissingChecks(requiredChecks, checks, workflows), []);
});

test("a missing exact-SHA check is reported after its workflow completes", () => {
  const workflows = [{ id: 1, event: "push", name: "Playwright E2E", status: "completed" }];
  assert.deepEqual(unresolvedMissingChecks(["e2e"], [], workflows), ["e2e"]);
});

test("a genuinely missing workflow remains a missing check and is independently caught", () => {
  assert.deepEqual(unresolvedMissingChecks(["e2e"], [], []), ["e2e"]);
});

test("the latest exact-SHA workflow attempt controls whether a check is still pending", () => {
  const workflows = [
    { id: 1, event: "push", name: "Playwright E2E", status: "completed" },
    { id: 2, event: "push", name: "Playwright E2E", status: "in_progress" }
  ];
  assert.deepEqual(unresolvedMissingChecks(["e2e"], [], workflows), []);
  assert.deepEqual(unresolvedMissingChecks(["e2e"], [{ name: "e2e" }], workflows), []);
});

test("pull-request workflows do not satisfy or defer exact-SHA main checks", () => {
  const workflows = [{ id: 2, event: "pull_request", name: "Playwright E2E", status: "in_progress" }];
  assert.deepEqual(unresolvedMissingChecks(["e2e"], [], workflows), ["e2e"]);
});
