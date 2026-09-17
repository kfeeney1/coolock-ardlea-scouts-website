import assert from "node:assert/strict";
import test from "node:test";
import { mapSubsPolicy } from "../../src/services/subsPolicyCompatibility.ts";

test("maps production-shaped legacy policies without inventing family totals", () => {
  const policy = mapSubsPolicy("legacy-2026", {
    period: "2026/27",
    standardCents: 26400,
    leaderChildCents: 20500,
    siblingCents: 15500,
  });
  assert.ok(policy);
  assert.equal(policy.period, "2026/27");
  assert.equal(policy.version, 1);
  assert.equal(policy.effectiveFrom, "");
  assert.deepEqual(policy.standardFamilyRatesCents, []);
  assert.deepEqual(policy.leaderFamilyRatesCents, []);
});

test("preserves current policy version, dates and family totals", () => {
  const policy = mapSubsPolicy("2026-v2", {
    period: "2026/27", effectiveFrom: "2026-10-01", periodStart: "2026-09-01", periodEnd: "2027-06-30",
    standardCents: 27000, leaderChildCents: 21000, siblingCents: 15000,
    standardFamilyRatesCents: [27000, 42000], leaderFamilyRatesCents: [21000, 35000], version: 2,
  });
  assert.ok(policy);
  assert.equal(policy.version, 2);
  assert.equal(policy.effectiveFrom, "2026-10-01");
  assert.deepEqual(policy.standardFamilyRatesCents, [27000, 42000]);
});

test("rejects records without a Scout year", () => {
  assert.equal(mapSubsPolicy("bad", { version: 1 }), null);
});
