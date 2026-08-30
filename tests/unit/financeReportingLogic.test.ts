import assert from "node:assert/strict";
import test from "node:test";
import { buildFinanceMonthlyTotals, buildFinanceReportSummary, filterFinanceTransactions, financeReportCsv } from "../../src/services/financeReportingLogic.ts";
import type { FinanceTransaction } from "../../src/services/financeLedgerLogic.ts";
import type { FinanceReceipt } from "../../src/services/financeReceipts.ts";

function transaction(overrides: Partial<FinanceTransaction> = {}): FinanceTransaction {
  return {
    id: "tx-1",
    section: "Cubs",
    type: "income",
    amountCents: 1000,
    category: "Weekly subs",
    description: "Subs",
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

test("finance report filters section, category and inclusive date range", () => {
  const rows = [
    transaction({ id: "a", section: "Cubs", transactionDate: "2026-08-01" }),
    transaction({ id: "b", section: "Scouts", transactionDate: "2026-08-15" }),
    transaction({ id: "c", section: "Cubs", category: "Camp income", transactionDate: "2026-09-01" }),
  ];
  const filtered = filterFinanceTransactions(rows, { section: "Cubs", category: "Weekly subs", fromDate: "2026-08-01", toDate: "2026-08-31" });
  assert.deepEqual(filtered.map((row) => row.id), ["a"]);
});

test("finance summary separates money movement and identifies missing expense receipts", () => {
  const rows = [
    transaction({ id: "income", type: "income", amountCents: 2000 }),
    transaction({ id: "expense-with-receipt", type: "expense", amountCents: 700 }),
    transaction({ id: "expense-missing", type: "expense", amountCents: 300 }),
    transaction({ id: "in", type: "transfer-in", amountCents: 500 }),
    transaction({ id: "out", type: "transfer-out", amountCents: 500 }),
    transaction({ id: "adjust", type: "adjustment", amountCents: -100, reversalOfTransactionId: "income" }),
  ];
  const summary = buildFinanceReportSummary(rows, [receipt]);
  assert.equal(summary.incomeCents, 2000);
  assert.equal(summary.expenseCents, 1000);
  assert.equal(summary.transferInCents, 500);
  assert.equal(summary.transferOutCents, 500);
  assert.equal(summary.adjustmentCents, -100);
  assert.equal(summary.netMovementCents, 900);
  assert.equal(summary.expenseCount, 2);
  assert.equal(summary.missingReceiptCount, 1);
});

test("monthly totals are newest first and preserve signed ledger movement", () => {
  const totals = buildFinanceMonthlyTotals([
    transaction({ id: "aug-income", transactionDate: "2026-08-05", type: "income", amountCents: 1000 }),
    transaction({ id: "aug-expense", transactionDate: "2026-08-06", type: "expense", amountCents: 250 }),
    transaction({ id: "sep-income", transactionDate: "2026-09-01", type: "income", amountCents: 300 }),
  ]);
  assert.deepEqual(totals, [
    { month: "2026-09", incomeCents: 300, expenseCents: 0, netCents: 300 },
    { month: "2026-08", incomeCents: 1000, expenseCents: 250, netCents: 750 },
  ]);
});

test("finance CSV flags missing receipts only for expense rows", () => {
  const csv = financeReportCsv([
    transaction({ id: "expense-with-receipt", type: "expense", description: "Rope, clips" }),
    transaction({ id: "income", type: "income" }),
  ], [receipt]);
  assert.match(csv, /Receipt status/);
  assert.match(csv, /"Rope, clips"/);
  assert.match(csv, /Attached/);
  assert.match(csv, /Not required/);
});
