import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  deployFirebaseRulesWithRetry,
  deployFirebaseTargetsInOrder,
  deployFirebaseTest,
  FIREBASE_RULES_BACKOFF_MS,
  FIREBASE_RULES_MAX_ATTEMPTS,
  retryableFirebaseRulesEndpoint,
} from "../../scripts/deploy-firebase-test-with-rules-retry.mjs";

const http503 = (endpoint) => ({
  code: 2,
  output: `Error: Request to https://firebaserules.googleapis.com/v1/projects/coolock-ardlea-scouts-test${endpoint} had HTTP Error: 503, The service is currently unavailable.`,
});

test("transient Rules API 503 retries, then deploys remaining TEST targets after rules succeed", async () => {
  const calls = [];
  const delays = [];
  const order = [];
  const run = async (args) => {
    calls.push(args);
    if (args.includes("firestore:rules")) {
      return calls.filter((call) => call.includes("firestore:rules")).length === 1
        ? http503("/test")
        : { code: 0, output: "Rules validated and deployed." };
    }
    order.push("remaining");
    return { code: 0, output: "Indexes, Storage rules, and Hosting deployed." };
  };
  const log = (message) => order.push(message.startsWith("Firebase Rules validation") ? "rules-succeeded" : "retry");

  await deployFirebaseTest({ run, sleep: async (delay) => delays.push(delay), log });

  assert.equal(calls.length, 3);
  assert.deepEqual(delays, [FIREBASE_RULES_BACKOFF_MS[0]]);
  assert.equal(order.indexOf("rules-succeeded") < order.indexOf("remaining"), true);
  assert.match(calls[0].join(" "), /firestore:rules/);
  assert.match(calls[2].join(" "), /firestore:indexes,storage:test-default,hosting/);
  assert.equal(calls[0].includes("coolock-ardlea-scouts-test"), true);
});

test("persistent Rules API 503 exhausts the bounded retry limit and never deploys remaining targets", async () => {
  const delays = [];
  const messages = [];
  let remainingDeploys = 0;
  await assert.rejects(
    deployFirebaseTargetsInOrder({
      deployRules: () => deployFirebaseRulesWithRetry({
        run: async () => http503("/rulesets"),
        sleep: async (delay) => delays.push(delay),
        log: (message) => messages.push(message),
      }),
      deployRemainingTargets: async () => { remainingDeploys += 1; },
    }),
    new RegExp(`failed after ${FIREBASE_RULES_MAX_ATTEMPTS}/${FIREBASE_RULES_MAX_ATTEMPTS} attempts.*HTTP 503.*\\/rulesets`),
  );

  assert.equal(delays.length, FIREBASE_RULES_MAX_ATTEMPTS - 1);
  assert.deepEqual(delays, FIREBASE_RULES_BACKOFF_MS);
  assert.equal(remainingDeploys, 0);
  assert.deepEqual(messages, [
    "Firebase Rules API /rulesets returned HTTP 503 on attempt 1/4; retrying in 5s (attempt 2/4).",
    "Firebase Rules API /rulesets returned HTTP 503 on attempt 2/4; retrying in 15s (attempt 3/4).",
    "Firebase Rules API /rulesets returned HTTP 503 on attempt 3/4; retrying in 30s (attempt 4/4).",
  ]);
});

test("authorization, invalid-rules, and non-Rules API failures are not retried", async () => {
  for (const output of [
    "Error: HTTP Error: 403, Permission denied.",
    "Error: Request to https://firebaserules.googleapis.com/v1/projects/test:test had HTTP Error: 400, invalid rules.",
    "Error: Request to https://firestore.googleapis.com/v1/projects/test:commit had HTTP Error: 503.",
  ]) {
    let attempts = 0;
    await assert.rejects(
      deployFirebaseRulesWithRetry({
        run: async () => { attempts += 1; return { code: 2, output }; },
        sleep: async () => assert.fail("non-retryable failure must not back off"),
        log: () => {},
      }),
      /not a retryable Firebase Rules API HTTP 503/,
    );
    assert.equal(attempts, 1);
  }
});

test("retry matching is limited to Firebase Rules API /test and /rulesets 503 responses", () => {
  assert.equal(retryableFirebaseRulesEndpoint(http503("/test").output), "/test");
  assert.equal(retryableFirebaseRulesEndpoint(http503("/rulesets").output), "/rulesets");
  assert.equal(retryableFirebaseRulesEndpoint("https://firestore.googleapis.com/v1/projects/p/test HTTP 503"), null);
  assert.equal(retryableFirebaseRulesEndpoint("https://firebaserules.googleapis.com/v1/projects/p:test HTTP 403"), null);
});

test("workflow runs all required Rules validation/deployment before other targets and keeps existing TEST gates", () => {
  const workflow = readFileSync(".github/workflows/firebase-hosting-test.yml", "utf8");
  const script = readFileSync("scripts/deploy-firebase-test-with-rules-retry.mjs", "utf8");

  assert.match(workflow, /node scripts\/deploy-firebase-test-with-rules-retry\.mjs/);
  assert.match(script, /firebase-tools@15\.28\.1/);
  assert.match(script, /"coolock-ardlea-scouts-test"/);
  assert.match(script, /firestore:rules/);
  assert.match(script, /firestore:indexes,storage:test-default,hosting/);
  assert.match(workflow, /seed-test-family-scenarios\.mjs seed/);
  assert.match(workflow, /check-live-build-info\.mjs/);
  assert.match(workflow, /test-environment-smoke\.spec\.ts/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
});

test("retry attempts and increasing delay schedule are finite and bounded", () => {
  assert.equal(FIREBASE_RULES_MAX_ATTEMPTS, 4);
  assert.deepEqual(FIREBASE_RULES_BACKOFF_MS, [5_000, 15_000, 30_000]);
  assert.ok(FIREBASE_RULES_MAX_ATTEMPTS <= 5);
  assert.ok(FIREBASE_RULES_BACKOFF_MS.reduce((total, delay) => total + delay, 0) <= 60_000);
});
