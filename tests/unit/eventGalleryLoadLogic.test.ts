import assert from "node:assert/strict";
import test from "node:test";

import { loadGalleryItems, withTimeout } from "../../src/services/eventGalleryLoadLogic.ts";

test("gallery retains legitimate photos when one listed object disappears", async () => {
  const photos = await loadGalleryItems(["first", "removed", "last"], async (item) => {
    if (item === "removed") throw Object.assign(new Error("missing"), { code: "storage/object-not-found" });
    return item;
  }, () => assert.fail("successful photos must remain usable"));
  assert.deepEqual(photos, ["first", "last"]);
});

test("empty gallery and non-gallery metadata produce an intentional empty result", async () => {
  assert.deepEqual(await loadGalleryItems([], async () => "unused", () => {}), []);
  assert.deepEqual(await loadGalleryItems(["unrelated"], async () => null, () => {}), []);
});

for (const code of ["storage/unauthorized", "storage/retry-limit-exceeded", "storage/unknown"]) {
  test(`gallery preserves ${code} and releases previously loaded photos`, async () => {
    let released: string[] = [];
    const failure = Object.assign(new Error("read failed"), { code });
    await assert.rejects(loadGalleryItems(["first", "failed"], async (item) => {
      if (item === "failed") throw failure;
      return item;
    }, (photos) => { released = photos; }), (error) => error === failure);
    assert.deepEqual(released, ["first"]);
  });
}

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
