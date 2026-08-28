import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EQUIPMENT_RESERVATION_NOTE_PREFIX,
  equipmentProgrammeStatus,
  isEquipmentReservationLoan,
  reservedQuantityForItem,
} from "../../src/services/equipmentProgrammeLogic.ts";

const requirement = { id: "event-e1", sourceType: "event" as const, sourceId: "e1", sourceLabel: "Camp", section: "Scouts", date: "2026-09-01", lines: [{ itemId: "tent", itemName: "Tent", quantity: 4 }], loanId: "loan1" };
const loan = (returnedQuantity: number, status: "open" | "returned" = "open", notes = "") => ({ id: "loan1", section: "Scouts", expectedReturnDate: "2026-09-02", notes, status, lines: [{ itemId: "tent", itemName: "Tent", quantity: 4, returnedQuantity, incidentQuantity: 0 }], createdBy: "u", createdAt: null, updatedBy: "u", updatedAt: null });

describe("equipment programme status", () => {
  it("keeps an unissued plan planned", () => assert.equal(equipmentProgrammeStatus({ ...requirement, loanId: "" }, []), "planned"));
  it("shows an active programme allocation as reserved", () => assert.equal(equipmentProgrammeStatus(requirement, [loan(0, "open", `${EQUIPMENT_RESERVATION_NOTE_PREFIX} event-e1 · Camp`)]), "reserved"));
  it("shows an issued plan checked out", () => assert.equal(equipmentProgrammeStatus(requirement, [loan(0)]), "checked-out"));
  it("shows partial returns", () => assert.equal(equipmentProgrammeStatus(requirement, [loan(2)]), "partially-returned"));
  it("shows completed returns", () => assert.equal(equipmentProgrammeStatus(requirement, [loan(4, "returned")]), "returned"));
  it("treats a cancelled reservation as planned again", () => assert.equal(equipmentProgrammeStatus(requirement, [loan(4, "returned", `${EQUIPMENT_RESERVATION_NOTE_PREFIX} event-e1 · Camp`)]), "planned"));
});

describe("equipment reservation accounting", () => {
  it("recognises only explicit reservation loan markers", () => {
    assert.equal(isEquipmentReservationLoan(loan(0, "open", `${EQUIPMENT_RESERVATION_NOTE_PREFIX} event-e1 · Camp`)), true);
    assert.equal(isEquipmentReservationLoan(loan(0)), false);
  });

  it("counts only outstanding active reserved stock", () => {
    const active = loan(1, "open", `${EQUIPMENT_RESERVATION_NOTE_PREFIX} event-e1 · Camp`);
    const returned = { ...loan(4, "returned", `${EQUIPMENT_RESERVATION_NOTE_PREFIX} event-e2 · Camp 2`), id: "loan2" };
    assert.equal(reservedQuantityForItem("tent", [active, returned]), 3);
    assert.equal(reservedQuantityForItem("stove", [active, returned]), 0);
  });
});
