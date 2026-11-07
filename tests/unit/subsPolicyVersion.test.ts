import assert from "node:assert/strict";
import test from "node:test";
import { nextSubsPolicyVersion } from "../../src/services/subsPolicyVersion.ts";
import type { SubsRatePolicy } from "../../src/services/subsLogic.ts";

const policy = (period: string, version: number, effectiveFrom = "2026-09-01"): SubsRatePolicy => ({
  id: `${period}-v${version}`, period, version, effectiveFrom,
  standardCents: 10000, leaderChildCents: 8000, siblingCents: 6000
});

test("first policy starts at one without borrowing another Scout year's version", () => {
  assert.equal(nextSubsPolicyVersion([], "2026/27"), 1);
  assert.equal(nextSubsPolicyVersion([policy("2025/26", 9)], "2026/27"), 1);
});

test("next immutable version follows all same-year policies including future effective dates", () => {
  const policies = [policy("2026/27", 2), policy("2025/26", 99), policy("2026/27", 7, "2099-01-01"), policy("2026/27", 1)];
  const original = structuredClone(policies);
  assert.equal(nextSubsPolicyVersion(policies, "2026/27"), 8);
  assert.deepEqual(policies, original, "old policy records and ordering must remain unchanged");
});
