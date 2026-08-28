import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { equipmentProgrammeStatus } from "../../src/services/equipmentProgrammeLogic.ts";

const requirement = { id: "event-e1", sourceType: "event" as const, sourceId: "e1", sourceLabel: "Camp", section: "Scouts", date: "2026-09-01", lines: [{ itemId: "tent", itemName: "Tent", quantity: 4 }], loanId: "loan1" };
const loan = (returnedQuantity: number, status: "open" | "returned" = "open") => ({ id: "loan1", section: "Scouts", expectedReturnDate: "2026-09-02", notes: "", status, lines: [{ itemId: "tent", itemName: "Tent", quantity: 4, returnedQuantity, incidentQuantity: 0 }], createdBy: "u", createdAt: null, updatedBy: "u", updatedAt: null });

describe("equipment programme status", () => {
  it("keeps an unissued plan planned", () => assert.equal(equipmentProgrammeStatus({ ...requirement, loanId: "" }, []), "planned"));
  it("shows an issued plan checked out", () => assert.equal(equipmentProgrammeStatus(requirement, [loan(0)]), "checked-out"));
  it("shows partial returns", () => assert.equal(equipmentProgrammeStatus(requirement, [loan(2)]), "partially-returned"));
  it("shows completed returns", () => assert.equal(equipmentProgrammeStatus(requirement, [loan(4, "returned")]), "returned"));
});
