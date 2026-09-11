import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/pages/EquipmentManagement.tsx", import.meta.url), "utf8");

test("new equipment can be assigned to an existing or newly created Store", () => {
  assert.match(source, /<InputLabel>Store<\/InputLabel>/);
  assert.match(source, /addEquipmentOption\("locations", safe\)/);
  assert.match(source, /Choose a category and Store/);
});
