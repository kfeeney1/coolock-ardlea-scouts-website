import assert from "node:assert/strict";
import test from "node:test";
import { equipmentReportAccess } from "../../src/security/equipmentReportAccess.ts";

test("equipment reports distinguish oversight from CSV export", () => {
  for (const profile of [{ role: "super-admin" }, { role: "leader", scoutingRole: "Group Leader" }]) {
    assert.deepEqual(equipmentReportAccess(profile), { canOpen: true, canExport: false });
  }
  for (const profile of [null, { role: "admin" }, { role: "leader", scoutingRole: "Deputy Group Leader" }]) {
    assert.deepEqual(equipmentReportAccess(profile), { canOpen: false, canExport: false });
  }
});

test("an active group Bo’sun appointment grants export alongside other appointments", () => {
  const secretary = { appointment: "Group Secretary", scope: "Group", active: true };
  const bosun = { appointment: "Group Bo’sun", scope: "Group", active: true };
  assert.deepEqual(equipmentReportAccess({ role: "leader", appointments: [secretary, bosun] }), { canOpen: true, canExport: true });
  for (const appointment of [{ ...bosun, active: false }, { ...bosun, scope: "Beavers" }, { ...bosun, endDate: "2000-01-01" }]) {
    assert.deepEqual(equipmentReportAccess({ role: "leader", appointments: [secretary, appointment] }), { canOpen: false, canExport: false });
  }
});
