import assert from "node:assert/strict";
import test from "node:test";

import { validateOperationalIntegrity } from "../../scripts/firestore-operational-integrity.mjs";

const map = (entries: Record<string, Record<string, unknown>>) => new Map(Object.entries(entries));

function validCollections() {
  return new Map([
    ["equipmentCategories", map({ tents: { name: "Tents" } })],
    ["equipmentLocations", map({ den: { name: "Den" } })],
    ["equipmentItems", map({ item1: { name: "Patrol tent", category: "Tents", location: "Den", trackingMode: "quantity", totalQuantity: 4, checkedOutQuantity: 1, unavailableQuantity: 0, condition: "good", archived: false } })],
    ["equipmentLoans", map({ loan1: { section: "Scouts", expectedReturnDate: "2026-09-10", status: "open", lines: [{ itemId: "item1", quantity: 1, returnedQuantity: 0, incidentQuantity: 0 }] } })],
    ["equipmentIncidents", new Map()],
    ["equipmentHistory", map({ history1: { itemId: "item1", type: "equipment-checked-out", quantity: 1 } })],
    ["events", map({ event1: { title: "Camp" } })],
    ["weeklyMeetings", new Map()],
    ["equipmentProgrammeRequirements", map({ requirement1: { sourceType: "event", sourceId: "event1", section: "Scouts", date: "2026-09-10", lines: [{ itemId: "item1", quantity: 1 }], loanId: "loan1" } })],
    ["financeTransactions", map({ tx1: { section: "Scouts", type: "opening-float", amountCents: 10000, category: "Opening float", description: "Float", transactionDate: "2026-09-01", sourceTransactionId: "", reversalOfTransactionId: "", createdBy: "leader1" } })],
    ["financeReconciliations", map({ rec1: { section: "Scouts", expectedBalanceCents: 10000, countedBalanceCents: 10000, differenceCents: 0, balanced: true, reconciledBy: "leader1" } })]
  ]);
}

test("accepts internally consistent finance and equipment records", () => {
  assert.deepEqual(validateOperationalIntegrity(validCollections()), []);
});

test("reports broken money, stock and cross-document invariants", () => {
  const collections = validCollections();
  collections.get("financeTransactions")!.set("bad-transfer", { section: "Cubs", type: "transfer-out", amountCents: -1, category: "Transfer", description: "Bad", transactionDate: "01/09/2026", sourceTransactionId: "missing", createdBy: "leader1" });
  collections.get("equipmentItems")!.get("item1")!.checkedOutQuantity = 5;
  collections.get("equipmentLoans")!.get("loan1")!.lines = [{ itemId: "missing", quantity: 1, returnedQuantity: 2, incidentQuantity: 0 }];
  collections.get("financeReconciliations")!.get("rec1")!.differenceCents = 50;

  const errors = validateOperationalIntegrity(collections);
  assert.ok(errors.some((error: string) => error.includes("amountCents is invalid")));
  assert.ok(errors.some((error: string) => error.includes("sourceTransactionId is missing")));
  assert.ok(errors.some((error: string) => error.includes("stock exceeds totalQuantity")));
  assert.ok(errors.some((error: string) => error.includes("references no equipment item")));
  assert.ok(errors.some((error: string) => error.includes("differenceCents does not match")));
});
