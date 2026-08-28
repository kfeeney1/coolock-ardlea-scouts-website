import assert from "node:assert/strict";
import test from "node:test";
import {
  availableAfterUnavailable,
  incidentRequiresUrgentNotification,
  incidentResolutionLabel,
  incidentStatusLabel,
  incidentTypeLabel,
  resolvedEquipmentQuantities,
  validateIncidentQuantity,
  validateIncidentResolution
} from "../../src/services/equipmentIncidentLogic.ts";

test("broken lost and missing incidents require urgent notification", () => {
  assert.equal(incidentRequiresUrgentNotification("damaged"), true);
  assert.equal(incidentRequiresUrgentNotification("lost"), true);
  assert.equal(incidentRequiresUrgentNotification("missing"), true);
  assert.equal(incidentRequiresUrgentNotification("maintenance"), false);
});

test("equipment incident labels remain leader friendly", () => {
  assert.equal(incidentTypeLabel("damaged"), "Broken / damaged");
  assert.equal(incidentTypeLabel("maintenance"), "Needs cleaning / maintenance");
  assert.equal(incidentStatusLabel("investigating"), "Investigating");
  assert.equal(incidentResolutionLabel("found-returned"), "Found / returned");
  assert.equal(incidentResolutionLabel("written-off"), "Written off");
});

test("unavailable stock is removed from checkout availability", () => {
  assert.equal(availableAfterUnavailable({ totalQuantity: 10, checkedOutQuantity: 3, unavailableQuantity: 2 }), 5);
  assert.equal(availableAfterUnavailable({ totalQuantity: 2, checkedOutQuantity: 2, unavailableQuantity: 2 }), 0);
});

test("incident quantity is bounded by source and archive state", () => {
  const item = { name: "Tent", totalQuantity: 8, checkedOutQuantity: 2, unavailableQuantity: 1, archived: false };
  assert.equal(validateIncidentQuantity(item, 5), null);
  assert.match(validateIncidentQuantity(item, 6) ?? "", /Only 5/);
  assert.match(validateIncidentQuantity(item, 3, 2) ?? "", /Only 2/);
  assert.match(validateIncidentQuantity({ ...item, archived: true }, 1) ?? "", /archived/);
  assert.match(validateIncidentQuantity(item, 0) ?? "", /greater than zero/);
});

test("write-offs require a reason", () => {
  assert.match(validateIncidentResolution("written-off", "") ?? "", /reason/);
  assert.equal(validateIncidentResolution("written-off", "Canvas beyond repair"), null);
  assert.equal(validateIncidentResolution("repaired", ""), null);
});

test("found repaired replaced and no-action incidents return stock to availability", () => {
  const item = { totalQuantity: 10, checkedOutQuantity: 2, unavailableQuantity: 3 };
  for (const resolution of ["found-returned", "repaired", "replaced", "no-action"] as const) {
    assert.deepEqual(resolvedEquipmentQuantities(item, 2, resolution), {
      totalQuantity: 10,
      unavailableQuantity: 1
    });
  }
});

test("written-off incidents reduce both unavailable and total stock", () => {
  const item = { totalQuantity: 10, checkedOutQuantity: 2, unavailableQuantity: 3 };
  assert.deepEqual(resolvedEquipmentQuantities(item, 2, "written-off"), {
    totalQuantity: 8,
    unavailableQuantity: 1
  });
});

test("resolution refuses inconsistent unavailable quantities", () => {
  assert.throws(
    () => resolvedEquipmentQuantities({ totalQuantity: 5, checkedOutQuantity: 1, unavailableQuantity: 1 }, 2, "repaired"),
    /greater than the equipment currently marked unavailable/
  );
});
