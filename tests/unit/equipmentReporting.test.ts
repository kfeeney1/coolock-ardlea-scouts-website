import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  currentSectionHoldingsCsv,
  equipmentInventoryCsv,
  equipmentUsageCsv,
  overdueEquipmentCsv,
  writeOffReplacementCsv,
  type EquipmentReportIncident,
  type EquipmentReportItem,
  type EquipmentReportLoan
} from "../../src/services/equipmentReportingLogic.ts";

const items: EquipmentReportItem[] = [
  { id: "tent", name: "Patrol Tent", category: "Camping", trackingMode: "quantity", totalQuantity: 10, checkedOutQuantity: 3, unavailableQuantity: 2, location: "Main Store", condition: "good", notes: "Dry before storage", replacementValue: 120, archived: false },
  { id: "rope", name: "Rope", category: "Pioneering", trackingMode: "quantity", totalQuantity: 20, checkedOutQuantity: 0, unavailableQuantity: 0, location: "Gear Room", condition: "good", notes: "=unsafe formula", replacementValue: 8.5, archived: false }
];

const loans: EquipmentReportLoan[] = [
  { id: "loan-1", section: "Scouts", expectedReturnDate: "2026-08-01", notes: "Camp", status: "open", lines: [{ itemId: "tent", itemName: "Patrol Tent", quantity: 3, returnedQuantity: 1, incidentQuantity: 0 }] },
  { id: "reservation-1", section: "Scouts", expectedReturnDate: "2026-09-01", notes: "[equipment-reservation] event-1 · Camp", status: "open", lines: [{ itemId: "rope", itemName: "Rope", quantity: 4, returnedQuantity: 0, incidentQuantity: 0 }] },
  { id: "loan-2", section: "Cubs", expectedReturnDate: "2026-07-01", notes: "Old loan", status: "returned", lines: [{ itemId: "rope", itemName: "Rope", quantity: 2, returnedQuantity: 2, incidentQuantity: 0 }] }
];

const incidents: EquipmentReportIncident[] = [
  { id: "i1", itemId: "tent", itemName: "Patrol Tent", itemCategory: "Camping", itemLocation: "Main Store", quantity: 2, type: "damaged", status: "resolved", section: "Scouts", description: "Poles bent", reportedAt: new Date("2026-07-10T12:00:00Z"), resolutionType: "written-off", resolutionNotes: "Beyond repair", resolvedAt: new Date("2026-07-12T12:00:00Z") }
];

describe("equipment reports", () => {
  it("exports all inventory with live availability and replacement values", () => {
    const report = equipmentInventoryCsv(items);
    assert.match(report, /"Patrol Tent"/);
    assert.match(report, /"10","5","3","2"/);
    assert.match(report, /"120\.00","1200\.00"/);
  });

  it("neutralises spreadsheet formulas in free text", () => {
    const report = equipmentInventoryCsv(items);
    assert.match(report, /"'=unsafe formula"/);
  });

  it("current holdings exclude future reservations and returned loans", () => {
    const report = currentSectionHoldingsCsv(loans);
    assert.match(report, /"Scouts","Patrol Tent","2"/);
    assert.doesNotMatch(report, /reservation-1/);
    assert.doesNotMatch(report, /loan-2/);
  });

  it("overdue report includes only outstanding non-reservation checkouts", () => {
    const report = overdueEquipmentCsv(loans, "2026-08-29");
    assert.match(report, /loan-1/);
    assert.doesNotMatch(report, /reservation-1/);
  });

  it("usage excludes reservation quantities", () => {
    const report = equipmentUsageCsv(loans);
    assert.match(report, /"Patrol Tent","1","3","1","0"/);
    assert.match(report, /"Rope","1","2","2","0"/);
  });

  it("write-off report calculates estimated replacement value", () => {
    const report = writeOffReplacementCsv(items, incidents);
    assert.match(report, /"Patrol Tent","2","2026-07-12","Scouts","Beyond repair","120\.00","240\.00"/);
  });

  it("inventory filters by category and location", () => {
    const report = equipmentInventoryCsv(items, { category: "Camping", location: "Main Store" });
    assert.match(report, /Patrol Tent/);
    assert.doesNotMatch(report, /"Rope"/);
  });
});
