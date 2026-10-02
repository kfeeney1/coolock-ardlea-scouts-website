import assert from "node:assert/strict";
import test from "node:test";
import { smokeSpecs, suiteSpecs } from "../../scripts/playwright-suites.mjs";
import { assignSpecsToShard, estimateSpecsSeconds, unmeasuredSpecSeconds } from "../../scripts/playwright-shards.mjs";

function assertAssignedExactlyOnce(selected: string[]) {
  const first = assignSpecsToShard(selected, 1);
  const second = assignSpecsToShard(selected, 2);
  const assigned = [...first, ...second];

  assert.equal(new Set(assigned).size, assigned.length, "no spec is assigned to both shards");
  const selectedNames = [...new Set(selected.map((spec) => spec.replaceAll("\\", "/").split("/").at(-1) ?? spec))];
  assert.deepEqual([...assigned].sort(), selectedNames.sort(), "both shards cover the selected specs");
  return [first, second];
}

test("measured full-suite weights balance the existing two shards", () => {
  const fullSuite = [...new Set(Object.values(suiteSpecs).flat())];
  const [first, second] = assertAssignedExactlyOnce(fullSuite);
  const firstSeconds = estimateSpecsSeconds(first);
  const secondSeconds = estimateSpecsSeconds(second);

  assert.ok(first.length > 0 && second.length > 0);
  assert.ok(Math.abs(firstSeconds - secondSeconds) / (firstSeconds + secondSeconds) < 0.01);
});

test("PR smoke and affected-suite subsets are assigned once and deterministically", () => {
  const selected = [...smokeSpecs, ...suiteSpecs.equipment, ...suiteSpecs["platform-ui"]];
  const [first, second] = assertAssignedExactlyOnce(selected);

  assert.deepEqual(first, assignSpecsToShard(selected, 1));
  assert.deepEqual(second, assignSpecsToShard(selected, 2));
  assert.ok(first.length > 0 && second.length > 0);
});

test("newly added specs receive the documented fallback estimate", () => {
  assert.equal(estimateSpecsSeconds(["e2e/new-contract.spec.ts"]), unmeasuredSpecSeconds);
  assertAssignedExactlyOnce(["e2e/new-contract.spec.ts"]);
});

test("invalid shard indexes fail before running Playwright", () => {
  assert.throws(() => assignSpecsToShard(["leader-navigation.spec.ts"], 0), /shardNumber/);
  assert.throws(() => assignSpecsToShard([], 1, 0), /shardCount/);
});
