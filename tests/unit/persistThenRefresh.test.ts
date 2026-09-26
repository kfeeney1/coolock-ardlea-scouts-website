import assert from "node:assert/strict";
import test from "node:test";
import { persistThenRefresh } from "../../src/services/persistThenRefresh.ts";

test("successful persistence remains successful when dependent refresh fails", async () => {
  let writes = 0;
  const refreshFailure = new Error("Missing or insufficient permissions.");
  const result = await persistThenRefresh(
    async () => { writes += 1; },
    async () => { throw refreshFailure; }
  );
  assert.equal(writes, 1);
  assert.equal(result.persisted, true);
  assert.equal(result.refreshed, false);
  if (!result.refreshed) assert.equal(result.refreshError, refreshFailure);
});

test("genuine persistence failure rejects and does not attempt refresh", async () => {
  let refreshes = 0;
  await assert.rejects(
    persistThenRefresh(
      async () => { throw new Error("write denied"); },
      async () => { refreshes += 1; }
    ),
    /write denied/
  );
  assert.equal(refreshes, 0);
});

test("successful persistence and refresh report a fully refreshed result", async () => {
  const result = await persistThenRefresh(async () => undefined, async () => undefined);
  assert.deepEqual(result, { persisted: true, refreshed: true });
});
