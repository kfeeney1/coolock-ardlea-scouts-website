export type FinanceTransactionType = "opening-float" | "income" | "expense" | "transfer-in" | "transfer-out" | "adjustment";

export type FinanceTransaction = {
  id: string;
  section: string;
  type: FinanceTransactionType;
  amountCents: number;
  category: string;
  description: string;
  transactionDate: string;
  sourceTransactionId: string;
  reversalOfTransactionId: string;
  createdBy: string;
};

export type FinanceTransactionInput = Omit<FinanceTransaction, "id" | "createdBy">;

export type FinanceReconciliation = {
  expectedBalanceCents: number;
  countedBalanceCents: number;
  differenceCents: number;
  balanced: boolean;
};

export const DEFAULT_FINANCE_CATEGORIES = [
  "Weekly subs",
  "Event income",
  "Camp income",
  "Fundraising",
  "Equipment",
  "Programme materials",
  "Food",
  "Transport",
  "Venue",
  "Reimbursement",
  "Bank / transfer",
  "Other"
] as const;

const POSITIVE_TYPES = new Set<FinanceTransactionType>(["opening-float", "income", "transfer-in"]);
const NEGATIVE_TYPES = new Set<FinanceTransactionType>(["expense", "transfer-out"]);

export function normaliseFinanceText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function signedAmountCents(transaction: Pick<FinanceTransaction, "type" | "amountCents">): number {
  if (!Number.isInteger(transaction.amountCents) || transaction.amountCents < 0) {
    throw new Error("Finance amounts must be stored as non-negative whole cents.");
  }
  if (POSITIVE_TYPES.has(transaction.type)) return transaction.amountCents;
  if (NEGATIVE_TYPES.has(transaction.type)) return -transaction.amountCents;
  return transaction.amountCents;
}

export function calculateLedgerBalanceCents(transactions: Array<Pick<FinanceTransaction, "type" | "amountCents">>): number {
  return transactions.reduce((total, transaction) => total + signedAmountCents(transaction), 0);
}

export function reconcileFinanceFloat(
  transactions: Array<Pick<FinanceTransaction, "type" | "amountCents">>,
  countedBalanceCents: number
): FinanceReconciliation {
  if (!Number.isInteger(countedBalanceCents) || countedBalanceCents < 0) {
    throw new Error("Counted balance must be a non-negative whole-cent amount.");
  }
  const expectedBalanceCents = calculateLedgerBalanceCents(transactions);
  const differenceCents = countedBalanceCents - expectedBalanceCents;
  return {
    expectedBalanceCents,
    countedBalanceCents,
    differenceCents,
    balanced: differenceCents === 0
  };
}

export function validateFinanceTransactionInput(input: FinanceTransactionInput): FinanceTransactionInput {
  const section = normaliseFinanceText(input.section);
  const category = normaliseFinanceText(input.category);
  const description = normaliseFinanceText(input.description);
  const transactionDate = input.transactionDate.trim();

  if (!section) throw new Error("Select a section.");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Enter an amount greater than zero.");
  if (!category) throw new Error("Select or enter a finance category.");
  if (!description) throw new Error("Enter a transaction description.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) throw new Error("Enter a valid transaction date.");
  if (input.type === "adjustment" && !input.reversalOfTransactionId.trim()) {
    throw new Error("Adjustments must reference the transaction being corrected.");
  }
  if (input.type !== "adjustment" && input.reversalOfTransactionId.trim()) {
    throw new Error("Only adjustment transactions may reverse an earlier transaction.");
  }

  return {
    ...input,
    section,
    category,
    description,
    transactionDate,
    sourceTransactionId: input.sourceTransactionId.trim(),
    reversalOfTransactionId: input.reversalOfTransactionId.trim()
  };
}

export function createReversalInput(original: FinanceTransaction, transactionDate: string, description?: string): FinanceTransactionInput {
  const oppositeType: FinanceTransactionType = POSITIVE_TYPES.has(original.type) ? "adjustment" : "adjustment";
  const originalSigned = signedAmountCents(original);
  return validateFinanceTransactionInput({
    section: original.section,
    type: oppositeType,
    amountCents: -originalSigned,
    category: original.category,
    description: description ?? `Correction of ${original.description}`,
    transactionDate,
    sourceTransactionId: original.sourceTransactionId,
    reversalOfTransactionId: original.id
  });
}
