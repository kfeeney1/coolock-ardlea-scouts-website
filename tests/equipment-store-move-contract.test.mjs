import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const management = fs.readFileSync(new URL("../src/pages/EquipmentManagement.tsx", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../src/services/equipment.ts", import.meta.url), "utf8");

test("existing equipment changes Store through the audited movement flow", () => {
  assert.match(management, /History \/ move Store/);
  assert.match(management, /To change an item's Store, use History \/ move Store/);
  assert.match(service, /Use History \/ move to change an equipment storage location/);
});
