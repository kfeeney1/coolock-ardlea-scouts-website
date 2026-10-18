import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("group-manager poll discovery declares its collection-group index and preserves collection indexes", () => {
  const definition = JSON.parse(readFileSync(new URL("../../firestore.indexes.json", import.meta.url), "utf8")) as {
    fieldOverrides: Array<{ collectionGroup: string; fieldPath: string; indexes: Array<{ queryScope: string; order?: string }> }>;
  };
  const field = definition.fieldOverrides.find((entry) => entry.collectionGroup === "audienceSections" && entry.fieldPath === "audienceType");
  assert.ok(field, "The audienceType-only collection-group discovery query needs a declared single-field index.");
  const modes = new Set(field.indexes.map((entry) => `${entry.queryScope}:${entry.order}`));
  assert.ok(modes.has("COLLECTION_GROUP:ASCENDING"));
  assert.ok(modes.has("COLLECTION:ASCENDING"));
  assert.ok(modes.has("COLLECTION:DESCENDING"));
});
