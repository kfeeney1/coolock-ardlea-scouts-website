import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/pages/EquipmentManagement.tsx", import.meta.url), "utf8");

test("Store management remains behind existing equipment manage permission", () => {
  assert.match(source, /const canManage = canManageEquipment\(adminProfile\)/);
  assert.match(source, /\{canManage && <Button variant="outlined" onClick=\{\(\) => setManageLocationsOpen\(true\)\}>Manage Stores<\/Button>\}/);
});
