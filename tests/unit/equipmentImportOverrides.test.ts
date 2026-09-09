import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("SW-42 source corrections remain explicit and source-row scoped", async () => {
  const payload = JSON.parse(await readFile("config/sw-42-equipment-source-overrides.json", "utf8"));
  assert.equal(payload.version, 1);
  assert.deepEqual(payload.reviewedOverrides, {
    "Hall:row-6": { quantity: 20 },
    "Hall:row-41": { quantity: 1, description: "3x2 size sofa" },
    "Hall:row-42": { quantity: 1, description: "4x1 size sofa" }
  });
});
