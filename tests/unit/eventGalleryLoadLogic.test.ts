import assert from "node:assert/strict";
import test from "node:test";

import { withTimeout } from "../../src/services/eventGalleryLoadLogic.ts";

test("withTimeout resolves when the operation finishes in time", async () => {
  assert.equal(await withTimeout(Promise.resolve("ok"), 50), "ok");
});

test("withTimeout rejects a stalled operation instead of waiting forever", async () => {
  await assert.rejects(
    withTimeout(new Promise<string>(() => undefined), 10, "Event gallery load timed out."),
    /Event gallery load timed out/
  );
});

test("withTimeout preserves the original operation error", async () => {
  await assert.rejects(
    withTimeout(Promise.reject(new Error("storage unavailable")), 50),
    /storage unavailable/
  );
});
