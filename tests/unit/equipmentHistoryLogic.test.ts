import assert from "node:assert/strict";
import test from "node:test";
import {
  availableStockForMovement,
  equipmentHistoryLabel,
  validateStockMovement
} from "../../src/services/equipmentHistoryLogic.ts";

const stock = {
  totalQuantity: 12,
  checkedOutQuantity: 3,
  unavailableQuantity: 2,
  archived: false,
  location: "Main Store"
};

test("movement availability excludes checked-out and unavailable stock", () => {
  assert.equal(availableStockForMovement(stock), 7);
  assert.equal(availableStockForMovement({ totalQuantity: 2, checkedOutQuantity: 4, unavailableQuantity: 1 }), 0);
});

test("stock movements require available whole stock and a different location", () => {
  assert.equal(validateStockMovement(stock, 4, "Trailer"), "");
  assert.match(validateStockMovement(stock, 8, "Trailer"), /Only 7 available/);
  assert.match(validateStockMovement(stock, 1.5, "Trailer"), /whole number/);
  assert.match(validateStockMovement(stock, 1, "main store"), /different storage location/);
  assert.match(validateStockMovement(stock, 1, ""), /destination storage location/);
});

test("archived stock cannot be moved", () => {
  assert.match(validateStockMovement({ ...stock, archived: true }, 1, "Trailer"), /Archived equipment/);
});

test("history labels remain leader friendly", () => {
  assert.equal(equipmentHistoryLabel("stock-moved-out"), "Stock moved out");
  assert.equal(equipmentHistoryLabel("incident-resolved"), "Issue resolved");
  assert.equal(equipmentHistoryLabel("equipment-returned"), "Returned");
});
