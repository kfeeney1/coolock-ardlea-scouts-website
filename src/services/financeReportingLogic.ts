import { FLOAT_CLOSE_CATEGORY, signedAmountCents, type FinanceTransaction } from "./financeLedgerLogic.ts";
import type { FinanceReceipt } from "./financeReceipts";

export interface FinanceReportFilters {
  section: string;
  category: string;
  fromDate: string;
  toDate: string;
}

export interface FinanceMonthlyTotal {
  month: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
}

export interface FinanceReportSummary {
  incomeCents: number;
  expenseCents: number;
  transferInCents: number;
  transferOutCents: number;
  adjustmentCents: number;
  openingFloatCents: number;
  netMovementCents: number;
  expenseCount: number;
  missingReceiptCount: number;
}

export function financeReceiptRequired(transaction: FinanceTransaction): boolean {
  return transaction.type === "expense" && transaction.category !== FLOAT_CLOSE_CATEGORY;
}

export function filterFinanceTransactions(transactions: FinanceTransaction[], filters: FinanceReportFilters): FinanceTransaction[] {
  return transactions.filter((transaction) => {
    if (filters.section && transaction.section !== filters.section) return false;
    if (filters.category && transaction.category !== filters.category) return false;
    if (filters.fromDate && transaction.transactionDate < filters.fromDate) return false;
    if (filters.toDate && transaction.transactionDate > filters.toDate) return false;
    return true;
  });
}

export function buildFinanceReportSummary(transactions: FinanceTransaction[], receipts: FinanceReceipt[]): FinanceReportSummary {
  const receiptTransactionIds = new Set(receipts.map((receipt) => receipt.transactionId));
  let incomeCents = 0;
  let expenseCents = 0;
  let transferInCents = 0;
  let transferOutCents = 0;
  let adjustmentCents = 0;
  let openingFloatCents = 0;
  let expenseCount = 0;
  let missingReceiptCount = 0;

  for (const transaction of transactions) {
    if (transaction.type === "income") incomeCents += transaction.amountCents;
    if (transaction.type === "expense") expenseCents += transaction.amountCents;
    if (financeReceiptRequired(transaction)) {
      expenseCount += 1;
      if (!receiptTransactionIds.has(transaction.id)) missingReceiptCount += 1;
    }
    if (transaction.type === "transfer-in") transferInCents += transaction.amountCents;
    if (transaction.type === "transfer-out") transferOutCents += transaction.amountCents;
    if (transaction.type === "opening-float") openingFloatCents += transaction.amountCents;
    if (transaction.type === "adjustment") adjustmentCents += signedAmountCents(transaction);
  }

  return {
    incomeCents,
    expenseCents,
    transferInCents,
    transferOutCents,
    adjustmentCents,
    openingFloatCents,
    netMovementCents: transactions.reduce((total, transaction) => total + signedAmountCents(transaction), 0),
    expenseCount,
    missingReceiptCount,
  };
}

export function buildFinanceMonthlyTotals(transactions: FinanceTransaction[]): FinanceMonthlyTotal[] {
  const totals = new Map<string, FinanceMonthlyTotal>();
  for (const transaction of transactions) {
    const month = /^\d{4}-\d{2}/.test(transaction.transactionDate) ? transaction.transactionDate.slice(0, 7) : "Unknown";
    const current = totals.get(month) ?? { month, incomeCents: 0, expenseCents: 0, netCents: 0 };
    if (transaction.type === "income") current.incomeCents += transaction.amountCents;
    if (transaction.type === "expense") current.expenseCents += transaction.amountCents;
    current.netCents += signedAmountCents(transaction);
    totals.set(month, current);
  }
  return [...totals.values()].sort((a, b) => b.month.localeCompare(a.month));
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function financeReportCsv(transactions: FinanceTransaction[], receipts: FinanceReceipt[]): string {
  const receiptCounts = new Map<string, number>();
  for (const receipt of receipts) receiptCounts.set(receipt.transactionId, (receiptCounts.get(receipt.transactionId) ?? 0) + 1);
  const header = ["Date", "Section", "Type", "Category", "Description", "Signed amount (EUR)", "Receipt count", "Receipt status"];
  const rows = transactions.map((transaction) => {
    const receiptCount = receiptCounts.get(transaction.id) ?? 0;
    const receiptStatus = financeReceiptRequired(transaction) ? (receiptCount > 0 ? "Attached" : "Missing") : "Not required";
    return [
      transaction.transactionDate,
      transaction.section,
      transaction.type,
      transaction.category,
      transaction.description,
      (signedAmountCents(transaction) / 100).toFixed(2),
      receiptCount,
      receiptStatus,
    ].map(csvCell).join(",");
  });
  return [header.join(","), ...rows].join("\n");
}
