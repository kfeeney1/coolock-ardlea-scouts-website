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
  createdAt?: Date | null;
};

export type FinanceTransactionInput = Omit<FinanceTransaction, "id" | "createdBy" | "createdAt">;

export type FinanceReconciliation = {
  expectedBalanceCents: number;
  countedBalanceCents: number;
  differenceCents: number;
  balanced: boolean;
};

export type FinanceReconciliationWrite = {
  section: string;
  expectedBalanceCents: number;
  countedBalanceCents: number;
  differenceCents: number;
  note: string;
};

export type FinanceReconciliationRecord = FinanceReconciliationWrite & {
  id: string;
  reconciledBy: string;
  reconciledAt: Date | null;
};

export const DEFAULT_FINANCE_CATEGORIES = [
  "Equipment",
  "Programme materials",
  "Food",
  "Transport",
  "Venue",
  "Reimbursement",
  "Other"
] as const;

export const FLOAT_OPEN_CATEGORY = "Opening float";
export const FLOAT_TOP_UP_CATEGORY = "Float top up";
export const FLOAT_CLOSE_CATEGORY = "Float closure";

const POSITIVE_TYPES = new Set<FinanceTransactionType>(["opening-float", "income", "transfer-in"]);
const NEGATIVE_TYPES = new Set<FinanceTransactionType>(["expense", "transfer-out"]);

export function normaliseFinanceText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function signedAmountCents(transaction: Pick<FinanceTransaction, "type" | "amountCents">): number {
  if (!Number.isInteger(transaction.amountCents)) {
    throw new Error("Finance amounts must be stored as whole cents.");
  }
  if (transaction.type === "adjustment") {
    if (transaction.amountCents === 0) throw new Error("Adjustments cannot be zero.");
    return transaction.amountCents;
  }
  if (transaction.amountCents < 0) {
    throw new Error("Non-adjustment finance amounts must be non-negative whole cents.");
  }
  if (POSITIVE_TYPES.has(transaction.type)) return transaction.amountCents;
  if (NEGATIVE_TYPES.has(transaction.type)) return -transaction.amountCents;
  return transaction.amountCents;
}

export function calculateLedgerBalanceCents(transactions: Array<Pick<FinanceTransaction, "type" | "amountCents">>): number {
  return transactions.reduce((total, transaction) => total + signedAmountCents(transaction), 0);
}

export function financeFloatIsOpen(transactions: FinanceTransaction[]): boolean {
  const reversedIds = new Set(
    transactions
      .filter((transaction) => transaction.type === "adjustment")
      .map((transaction) => transaction.reversalOfTransactionId.trim())
      .filter(Boolean)
  );
  const lifecycle = transactions
    .filter((transaction) => transaction.type !== "adjustment" && !reversedIds.has(transaction.id))
    .filter((transaction) => transaction.type === "opening-float" || (transaction.type === "expense" && transaction.category === FLOAT_CLOSE_CATEGORY))
    .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate) || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) || a.id.localeCompare(b.id));

  return lifecycle.reduce(
    (open, transaction) => transaction.type === "opening-float" ? true : transaction.category === FLOAT_CLOSE_CATEGORY ? false : open,
    false
  );
}

export function assertNonNegativeFinanceBalance(currentBalanceCents: number, movementCents: number): number {
  if (!Number.isInteger(currentBalanceCents) || currentBalanceCents < 0) {
    throw new Error("The current float balance is invalid and must be reconciled before adding another transaction.");
  }
  if (!Number.isInteger(movementCents)) throw new Error("Finance movement must be stored as whole cents.");
  const nextBalanceCents = currentBalanceCents + movementCents;
  if (nextBalanceCents < 0) throw new Error("This transaction would take the section float below €0.00.");
  return nextBalanceCents;
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

export function createFinanceReconciliationWrite(
  sectionValue: string,
  transactions: Array<Pick<FinanceTransaction, "type" | "amountCents">>,
  countedBalanceCents: number,
  noteValue: string
): FinanceReconciliationWrite {
  const section = normaliseFinanceText(sectionValue);
  const note = normaliseFinanceText(noteValue);
  if (!section) throw new Error("Select a section.");
  const result = reconcileFinanceFloat(transactions, countedBalanceCents);
  if (!result.balanced && !note) throw new Error("Add a note explaining the cash difference.");
  return {
    section,
    expectedBalanceCents: result.expectedBalanceCents,
    countedBalanceCents: result.countedBalanceCents,
    differenceCents: result.differenceCents,
    note
  };
}

export function validateFinanceTransactionInput(input: FinanceTransactionInput): FinanceTransactionInput {
  const section = normaliseFinanceText(input.section);
  const category = normaliseFinanceText(input.category);
  const description = normaliseFinanceText(input.description);
  const transactionDate = input.transactionDate.trim();
  const zeroBalanceClosure = input.type === "expense" && category === FLOAT_CLOSE_CATEGORY && input.amountCents === 0;

  if (!section) throw new Error("Select a section.");
  if (!Number.isInteger(input.amountCents)) throw new Error("Enter an amount in whole cents.");
  if (input.type === "adjustment") {
    if (input.amountCents === 0) throw new Error("Enter a non-zero adjustment amount.");
  } else if (input.amountCents <= 0 && !zeroBalanceClosure) {
    throw new Error("Enter an amount greater than zero.");
  }
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
  return validateFinanceTransactionInput({
    section: original.section,
    type: "adjustment",
    amountCents: -signedAmountCents(original),
    category: original.category,
    description: description ?? `Correction of ${original.description}`,
    transactionDate,
    sourceTransactionId: original.sourceTransactionId,
    reversalOfTransactionId: original.id
  });
}
