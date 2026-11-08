import assert from "node:assert/strict";
import test from "node:test";
import { equipmentManager } from "../src/equipmentOptions.js";

test("equipment mutations use the canonical active group appointment union", () => {
  const profile = { active: true, role: "leader", sections: ["Scouts"] };
  const legacy = { active: true, scoutingRole: "Group Quartermaster" };
  const today = "2026-11-08";
  const role = { appointment: "DGL", scope: "Group", startDate: today, endDate: today };
  assert.equal(equipmentManager(profile, legacy, today), true);
  assert.equal(equipmentManager(profile, { ...legacy, appointments: Array(12).fill(null).concat(role) }, today), false);
  assert.equal(equipmentManager(profile, { ...legacy, appointments: [...Array(11).fill(null), role] }, today), true);
  for (const appointment of [{ ...role, scope: "Scouts" }, { ...role, active: false }, { ...role, endDate: "2026-11-07" }, { ...role, startDate: "2026-02-30" }]) {
    assert.equal(equipmentManager(profile, { ...legacy, appointments: [appointment] }, today), false);
  }
  assert.equal(equipmentManager({ ...profile, active: false, role: "admin" }, legacy, today), false);
  assert.equal(equipmentManager({ ...profile, role: "admin" }, undefined, today), true);
});
