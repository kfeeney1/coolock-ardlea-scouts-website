import assert from "node:assert/strict";
import test from "node:test";

import { trySecondaryRefresh } from "../../src/services/secondaryRefresh.ts";

test("reports a successful secondary refresh", async () => {
  let calls = 0;
  const refreshed = await trySecondaryRefresh(async () => { calls += 1; }, "test data");
  assert.equal(refreshed, true);
  assert.equal(calls, 1);
});

test("does not turn a completed write into a rejected operation when refresh fails", async () => {
  const originalError = console.error;
  const errors: unknown[][] = [];
  console.error = (...values: unknown[]) => { errors.push(values); };
  try {
    const refreshed = await trySecondaryRefresh(
      async () => { throw new Error("reload unavailable"); },
      "test data"
    );
    assert.equal(refreshed, false);
    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.[0], "Application failure");
    const diagnostic = errors[0]?.[1] as { operation: string; reference: string; category: string };
    assert.match(diagnostic.operation, /after a successful save/);
    assert.match(diagnostic.reference, /^ERR-/);
    assert.equal(diagnostic.category, "unexpected");
  } finally {
    console.error = originalError;
  }
});
