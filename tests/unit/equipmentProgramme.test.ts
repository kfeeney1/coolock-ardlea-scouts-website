import { describe, expect, it } from "vitest";
import { equipmentProgrammeStatus } from "../../src/services/equipmentProgramme";

const requirement = { id: "event-e1", sourceType: "event" as const, sourceId: "e1", sourceLabel: "Camp", section: "Scouts", date: "2026-09-01", lines: [{ itemId: "tent", itemName: "Tent", quantity: 4 }], loanId: "loan1" };
const loan = (returnedQuantity: number, status: "open" | "returned" = "open") => ({ id: "loan1", section: "Scouts", expectedReturnDate: "2026-09-02", notes: "", status, lines: [{ itemId: "tent", itemName: "Tent", quantity: 4, returnedQuantity, incidentQuantity: 0 }], createdBy: "u", createdAt: null, updatedBy: "u", updatedAt: null });

describe("equipment programme status", () => {
  it("keeps an unissued plan planned", () => expect(equipmentProgrammeStatus({ ...requirement, loanId: "" }, [])).toBe("planned"));
  it("shows an issued plan checked out", () => expect(equipmentProgrammeStatus(requirement, [loan(0)])).toBe("checked-out"));
  it("shows partial returns", () => expect(equipmentProgrammeStatus(requirement, [loan(2)])).toBe("partially-returned"));
  it("shows completed returns", () => expect(equipmentProgrammeStatus(requirement, [loan(4, "returned")])).toBe("returned"));
});
