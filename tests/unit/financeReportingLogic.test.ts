import assert from "node:assert/strict";
import test from "node:test";
import { buildFinanceMonthlyTotals, buildFinanceReportSummary, filterFinanceTransactions, financeReportCsv } from "../../src/services/financeReportingLogic.ts";
import { FLOAT_CLOSE_CATEGORY, type FinanceTransaction } from "../../src/services/financeLedgerLogic.ts";
import type { FinanceReceipt } from "../../src/services/financeReceipts.ts";

function transaction(overrides: Partial<FinanceTransaction> = {}): FinanceTransaction {
  return {
    id: "tx-1",
    section: "Cubs",
    type: "income",
    amountCents: 1000,
    category: "Float top up",
    description: "Float top up",
    transactionDate: "2026-08-10",
    sourceTransactionId: "",
    reversalOfTransactionId: "",
    createdBy: "leader",
    ...overrides,
  };
}

const receipt: FinanceReceipt = {
  id: "receipt-1",
  transactionId: "expense-with-receipt",
  section: "Cubs",
  storagePath: "attachments/finance-receipts/Cubs/a/receipt.pdf",
  fileName: "receipt.pdf",
  contentType: "application/pdf",
  size: 100,
  downloadUrl: "https://example.test/receipt",
  uploadedBy: "leader",
};

test("finance report filters section, outgoing category and inclusive date range", () => {
  const rows = [
    transaction({ id: "a", section: "Cubs", type: "expense", category: "Equipment", transactionDate: "2026-08-01" }),
    transaction({ id: "b", section: "Scouts", type: "expense", category: "Equipment", transactionDate: "2026-08-15" }),
    transaction({ id: "c", section: "Cubs", type: "expense", category: "Food", transactionDate: "2026-09-01" }),
  ];
  const filtered = filterFinanceTransactions(rows, { section: "Cubs", category: "Equipment", fromDate: "2026-08-01", toDate: "2026-08-31" });
  assert.deepEqual(filtered.map((row) => row.id), ["a"]);
});

test("finance summary separates float movement and identifies missing money-out receipts", () => {
  const rows = [
    transaction({ id: "income", type: "income", amountCents: 2000 }),
    transaction({ id: "expense-with-receipt", type: "expense", amountCents: 700, category: "Equipment" }),
    transaction({ id: "expense-missing", type: "expense", amountCents: 300, category: "Food" }),
    transaction({ id: "float-close", type: "expense", amountCents: 200, category: FLOAT_CLOSE_CATEGORY }),
    transaction({ id: "in", type: "transfer-in", amountCents: 500 }),
    transaction({ id: "out", type: "transfer-out", amountCents: 500 }),
    transaction({ id: "adjust", type: "adjustment", amountCents: -100, reversalOfTransactionId: "income" }),
  ];
  const summary = buildFinanceReportSummary(rows, [receipt]);
  assert.equal(summary.incomeCents, 2000);
  assert.equal(summary.expenseCents, 1200);
  assert.equal(summary.transferInCents, 500);
  assert.equal(summary.transferOutCents, 500);
  assert.equal(summary.adjustmentCents, -100);
  assert.equal(summary.netMovementCents, 700);
  assert.equal(summary.expenseCount, 2);
  assert.equal(summary.missingReceiptCount, 1);
});

test("monthly totals are newest first and preserve signed float movement", () => {
  const totals = buildFinanceMonthlyTotals([
    transaction({ id: "aug-income", transactionDate: "2026-08-05", type: "income", amountCents: 1000 }),
    transaction({ id: "aug-expense", transactionDate: "2026-08-06", type: "expense", amountCents: 250, category: "Equipment" }),
    transaction({ id: "sep-income", transactionDate: "2026-09-01", type: "income", amountCents: 300 }),
  ]);
  assert.deepEqual(totals, [
    { month: "2026-09", incomeCents: 300, expenseCents: 0, netCents: 300 },
    { month: "2026-08", incomeCents: 1000, expenseCents: 250, netCents: 750 },
  ]);
});

test("finance CSV requires receipts for money out but not float closure", () => {
  const csv = financeReportCsv([
    transaction({ id: "expense-with-receipt", type: "expense", category: "Equipment", description: "Rope, clips" }),
    transaction({ id: "close", type: "expense", category: FLOAT_CLOSE_CATEGORY, description: "Close float" }),
    transaction({ id: "income", type: "income" }),
  ], [receipt]);
  assert.match(csv, /Receipt status/);
  assert.match(csv, /"Rope, clips"/);
  assert.match(csv, /Attached/);
  assert.match(csv, /Float closure,Close float,-10\.00,0,Not required/);
  assert.match(csv, /Not required/);
});
