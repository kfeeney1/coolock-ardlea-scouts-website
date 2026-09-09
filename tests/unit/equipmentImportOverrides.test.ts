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

test("committed SW-42 seed contains every reviewed row with provenance", async () => {
  const payload = JSON.parse(await readFile("config/sw-42-equipment-seed.json", "utf8"));
  assert.equal(payload.version, 1);
  assert.equal(payload.batch, "sw-42-coolok-2025-2026");
  assert.equal(payload.records.length, 136);
  assert.equal(payload.preparationRejected.length, 0);
  assert.equal(payload.reviewedOverridesApplied.length, 3);
  assert.ok(payload.records.every((record) => record.source === "spreadsheet-import" && record.importBatch === payload.batch));
  assert.equal(payload.records.find((record) => record.importSourceRef === "Hall:row-6")?.totalQuantity, 20);
  assert.equal(payload.records.find((record) => record.importSourceRef === "Hall:row-41")?.name, "3x2 size sofa");
  assert.equal(payload.records.find((record) => record.importSourceRef === "Hall:row-42")?.name, "4x1 size sofa");
});
