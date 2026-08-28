import assert from "node:assert/strict";
import test from "node:test";
import {
  canDeleteEquipmentOption,
  canManageEquipment,
  equipmentLabelKey,
  isDuplicateEquipmentLabel,
  isQuartermasterRole,
  normaliseEquipmentLabel
} from "../../src/services/equipmentLogic.ts";

function profile(overrides: Record<string, unknown> = {}) {
  return {
    uid: "leader-1",
    email: "leader@example.test",
    displayName: "Test Leader",
    role: "leader",
    sections: ["Scouts"],
    active: true,
    scoutingRole: "Section Leader",
    organisationSection: "Scouts",
    ...overrides
  } as never;
}

test("equipment labels are trimmed and normalised", () => {
  assert.equal(normaliseEquipmentLabel("  Main   Store  "), "Main Store");
  assert.equal(equipmentLabelKey(" MAIN Store "), "main store");
});

test("equipment option duplicate checks are case insensitive", () => {
  assert.equal(isDuplicateEquipmentLabel(" main store ", ["Main Store", "Trailer"]), true);
  assert.equal(isDuplicateEquipmentLabel("Boat Shed", ["Main Store", "Trailer"]), false);
});

test("quartermaster appointment variants are recognised", () => {
  assert.equal(isQuartermasterRole("Group Quartermaster"), true);
  assert.equal(isQuartermasterRole("Group Quartermaster / Bo'sun"), true);
  assert.equal(isQuartermasterRole("Group Bo'sun"), true);
  assert.equal(isQuartermasterRole("Section Leader"), false);
});

test("equipment management is restricted to the expected roles", () => {
  assert.equal(canManageEquipment(profile({ scoutingRole: "Group Quartermaster / Bo'sun" })), true);
  assert.equal(canManageEquipment(profile({ scoutingRole: "Group Leader" })), true);
  assert.equal(canManageEquipment(profile({ role: "admin" })), true);
  assert.equal(canManageEquipment(profile()), false);
  assert.equal(canManageEquipment(null), false);
});

test("only unused categories and locations can be deleted", () => {
  assert.equal(canDeleteEquipmentOption("Trailer", ["Main Store", "Trailer"]), false);
  assert.equal(canDeleteEquipmentOption("Boat Shed", ["Main Store", "Trailer"]), true);
  assert.equal(canDeleteEquipmentOption(" main store ", ["Main Store"]), false);
});
