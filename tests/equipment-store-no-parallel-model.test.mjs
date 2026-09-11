import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const equipment = fs.readFileSync(new URL("../src/services/equipment.ts", import.meta.url), "utf8");
const management = fs.readFileSync(new URL("../src/pages/EquipmentManagement.tsx", import.meta.url), "utf8");

test("Stores continue to use equipmentLocations and item.location", () => {
  assert.match(equipment, /equipmentLocations/);
  assert.match(management, /item\.location/);
  assert.doesNotMatch(management, /collection\([^\n]*equipmentStores/);
});
