import assert from "node:assert/strict";
import test from "node:test";
import {
  availableAfterUnavailable,
  incidentRequiresUrgentNotification,
  incidentTypeLabel,
  validateIncidentQuantity
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
