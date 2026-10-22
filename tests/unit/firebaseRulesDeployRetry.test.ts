import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import { publishReviewedRules, deliveryConfig, RULES_ATTEMPTS, RULES_BACKOFF_MS, publishTestRules } from "../../scripts/publish-test-rules.mjs";
import { deployFirebaseTest } from "../../scripts/deploy-firebase-test-with-rules-retry.mjs";

const name = "firestore.rules";
const source = "rules_version = '2'; service cloud.firestore { match /databases/{d}/documents { match /{p=**} { allow read, write: if false; } } }";
const ruleset = { name: "compiled", source: [{ name, content: source }] };
const unavailable = () => Object.assign(new Error("private SDK payload"), { httpResponse: { status: 503 } });
const quiet = () => {};

test("unchanged active reviewed Rules need no compilation or publication", async () => {
  await publishReviewedRules({ name, source, getLive: async () => ruleset,
    create: async () => assert.fail("already published"), release: async () => assert.fail("already published"), log: quiet });
});

test("changed Rules compile once, publish, then verify release name and complete source", async () => {
  const order = [];
  let live = { ...ruleset, source: [{ name, content: "old" }] };
  await publishReviewedRules({ name, source, getLive: async () => { order.push("read"); return live; },
    create: async (file) => { order.push("compile"); assert.deepEqual(file, { name, content: source }); return ruleset; },
    release: async (created) => { order.push("release"); live = created; }, log: quiet });
  assert.deepEqual(order, ["read", "compile", "release", "read"]);
});

test("503 during release reuses compiled Rules and keeps the finite backoff", async () => {
  let creates = 0, releases = 0;
  const delays = [];
  let live;
  await publishReviewedRules({ name, source, getLive: async () => live,
    create: async () => { creates++; return ruleset; },
    release: async () => { if (++releases === 1) throw unavailable(); live = ruleset; },
    sleep: async (ms) => { delays.push(ms); }, log: quiet });
  assert.equal(creates, 1); assert.equal(releases, 2); assert.deepEqual(delays, [5000]);
});

test("ambiguous release success is recovered by reading matching active Rules", async () => {
  let live;
  await publishReviewedRules({ name, source, getLive: async () => live,
    create: async () => ruleset, release: async () => { live = ruleset; throw unavailable(); },
    sleep: async () => {}, log: quiet });
});

test("persistent 503 stops at four attempts and prevents indexes/Hosting", async () => {
  let creates = 0;
  const delays = [];
  await assert.rejects(deployFirebaseTest({ publishRules: () => publishReviewedRules({ name, source,
    getLive: async () => undefined, create: async () => { creates++; throw unavailable(); },
    release: async () => assert.fail("no compiled Rules"), sleep: async (ms) => { delays.push(ms); }, log: quiet }),
    run: async () => assert.fail("Rules must be verified first") }), /attempt 4\/4.*HTTP 503/);
  assert.equal(creates, RULES_ATTEMPTS); assert.deepEqual(delays, RULES_BACKOFF_MS);
});

test("400, 403 and 409 are fatal without retry, release or payload disclosure", async () => {
  for (const status of [400, 403, 409]) {
    await assert.rejects(publishReviewedRules({ name, source, getLive: async () => { throw Object.assign(new Error("SECRET"), { httpResponse: { status } }); },
      create: async () => assert.fail("must fail closed"), release: async () => assert.fail("must fail closed"),
      sleep: async () => assert.fail("no retry"), log: quiet }), (error) => {
      assert.match(error.message, new RegExp(`HTTP ${status}`)); assert.doesNotMatch(error.message, /SECRET/); return true;
    });
  }
});

test("only missing release permits initial publication; failed read-back never passes", async () => {
  let live, released = false;
  await publishReviewedRules({ name, source, getLive: async () => { if (!released) throw Object.assign(new Error(), { code: "security-rules/not-found" }); return live; },
    create: async () => ruleset, release: async () => { released = true; live = ruleset; }, log: quiet });
  for (const invalid of [{ ...ruleset, name: "wrong-release" }, { ...ruleset, source: [] }, { ...ruleset, source: [...ruleset.source, { name: "extra", content: source }] }]) {
    let reads = 0;
    await assert.rejects(publishReviewedRules({ name, source, getLive: async () => ++reads === 1 ? undefined : invalid,
      create: async () => ruleset, release: async () => {}, log: quiet }), /active release is not verified/);
  }
});

test("remaining CLI config excludes already verified Rules and retains exact indexes/Hosting", async () => {
  const original = JSON.parse(readFileSync("firebase.test.json", "utf8"));
  const config = deliveryConfig(original);
  assert.equal(config.firestore.rules, undefined); assert.equal(config.storage, undefined);
  assert.equal(original.firestore.rules, "firestore.rules");
  assert.deepEqual(config.hosting, original.hosting);
  assert.equal(config.firestore.indexes, "firestore.indexes.json");
  assert.throws(() => deliveryConfig({ ...original, firestore: { ...original.firestore, rules: "unreviewed.rules" } }));
  assert.throws(() => deliveryConfig({ ...original, storage: [...original.storage, original.storage[0]] }));
  let configPath;
  await assert.rejects(deployFirebaseTest({ publishRules: async () => {}, run: async (args) => {
    configPath = args[args.indexOf("--config") + 1];
    assert.deepEqual(JSON.parse(readFileSync(configPath, "utf8")), config);
    assert.equal(args[args.indexOf("--only") + 1], "firestore:indexes,hosting");
    assert.equal(args[args.indexOf("--project") + 1], "coolock-ardlea-scouts-test");
    return { code: 1 };
  } }), /indexes and Hosting deployment failed/);
  assert.equal(existsSync(configPath), false);
});

test("Rules publisher rejects production, mismatched credentials and emulators before network use", async () => {
  const keys = ["DEPLOY_ENVIRONMENT", "FIREBASE_PROJECT_ID", "FIREBASE_SERVICE_ACCOUNT_JSON", "FIRESTORE_EMULATOR_HOST"];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const [environment, project, credential, emulator] of [
      ["production", "coolock-ardlea-scouts", "coolock-ardlea-scouts", ""],
      ["test", "coolock-ardlea-scouts-test", "coolock-ardlea-scouts", ""],
      ["test", "coolock-ardlea-scouts-test", "coolock-ardlea-scouts-test", "localhost:8080"],
    ]) {
      process.env.DEPLOY_ENVIRONMENT = environment; process.env.FIREBASE_PROJECT_ID = project;
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: credential }); process.env.FIRESTORE_EMULATOR_HOST = emulator;
      await assert.rejects(publishTestRules());
    }
  } finally {
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
});

test("TEST retains seed, release metadata and browser gates without continue-on-error", () => {
  const workflow = readFileSync(".github/workflows/firebase-hosting-test.yml", "utf8");
  for (const gate of ["deploy-firebase-test-with-rules-retry.mjs", "seed-test-family-scenarios.mjs seed", "check-live-build-info.mjs", "test-environment-smoke.spec.ts"]) assert.ok(workflow.includes(gate));
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
  assert.equal(RULES_ATTEMPTS, 4); assert.deepEqual(RULES_BACKOFF_MS, [5000, 15000, 30000]);
});
