import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FINANCE_CATEGORIES,
  FLOAT_CLOSE_CATEGORY,
  assertNonNegativeFinanceBalance,
  calculateLedgerBalanceCents,
  createFinanceReconciliationWrite,
  createReversalInput,
  financeFloatIsOpen,
  reconcileFinanceFloat,
  validateFinanceTransactionInput,
  type FinanceTransaction
} from "../../src/services/financeLedgerLogic.ts";

const transaction = (overrides: Partial<FinanceTransaction> = {}): FinanceTransaction => ({
  id: "txn-1",
  section: "Cubs",
  type: "opening-float",
  amountCents: 5000,
  category: "Opening float",
  description: "Open float",
  transactionDate: "2026-08-30",
  sourceTransactionId: "",
  reversalOfTransactionId: "",
  createdBy: "leader-1",
  ...overrides
});

test("calculates a section float from immutable ledger entries", () => {
  assert.equal(calculateLedgerBalanceCents([
    { type: "opening-float", amountCents: 5000 },
    { type: "income", amountCents: 2400 },
    { type: "expense", amountCents: 1750 },
    { type: "transfer-in", amountCents: 1000 },
    { type: "transfer-out", amountCents: 500 }
  ]), 6150);
});

test("section float movements cannot take the balance below zero", () => {
  assert.equal(assertNonNegativeFinanceBalance(5000, -1750), 3250);
  assert.equal(assertNonNegativeFinanceBalance(0, 2500), 2500);
  assert.throws(() => assertNonNegativeFinanceBalance(1000, -1001), /below €0\.00/);
});

test("float lifecycle requires an opening record and treats an exhausted float as closed", () => {
  const opened = transaction();
  assert.equal(financeFloatIsOpen([opened]), true);

  const spentToZero = transaction({ id: "txn-2", type: "expense", amountCents: 5000, category: "Equipment", description: "Tent" });
  assert.equal(calculateLedgerBalanceCents([opened, spentToZero]), 0);
  assert.equal(financeFloatIsOpen([opened, spentToZero]), false);

  const incomeWithoutOpening = transaction({ id: "txn-3", type: "income", amountCents: 1000, category: "Float top up", description: "Top up" });
  assert.equal(financeFloatIsOpen([incomeWithoutOpening]), false);
});

test("explicit closure and corrections determine the active float lifecycle", () => {
  const opened = transaction();
  const closed = transaction({ id: "txn-2", type: "expense", amountCents: 5000, category: FLOAT_CLOSE_CATEGORY, description: "Close float", transactionDate: "2026-08-31" });
  assert.equal(financeFloatIsOpen([opened, closed]), false);

  const reversedOpening = transaction({ id: "reversal-txn-1", type: "adjustment", amountCents: -5000, category: "Opening float", description: "Correction", reversalOfTransactionId: "txn-1" });
  assert.equal(financeFloatIsOpen([opened, reversedOpening]), false);

  const reversedClose = transaction({ id: "reversal-txn-2", type: "adjustment", amountCents: 5000, category: FLOAT_CLOSE_CATEGORY, description: "Correction", transactionDate: "2026-09-01", reversalOfTransactionId: "txn-2" });
  assert.equal(financeFloatIsOpen([opened, closed, reversedClose]), true);
});

test("default finance categories contain outgoing purposes only", () => {
  assert.deepEqual([...DEFAULT_FINANCE_CATEGORIES], [
    "Equipment",
    "Programme materials",
    "Food",
    "Transport",
    "Venue",
    "Reimbursement",
    "Other"
  ]);
});

test("reconciliation exposes rather than silently fixes float differences", () => {
  const result = reconcileFinanceFloat([
    { type: "opening-float", amountCents: 10000 },
    { type: "expense", amountCents: 1250 }
  ], 8500);

  assert.deepEqual(result, {
    expectedBalanceCents: 8750,
    countedBalanceCents: 8500,
    differenceCents: -250,
    balanced: false
  });
});

test("reconciliation writes snapshot expected and counted cash without changing the ledger", () => {
  const transactions = [
    { type: "opening-float" as const, amountCents: 5000 },
    { type: "income" as const, amountCents: 1000 },
    { type: "expense" as const, amountCents: 750 }
  ];
  assert.deepEqual(createFinanceReconciliationWrite(" Cubs ", transactions, 5250, ""), {
    section: "Cubs",
    expectedBalanceCents: 5250,
    countedBalanceCents: 5250,
    differenceCents: 0,
    note: ""
  });
});

test("cash differences require an explanatory reconciliation note", () => {
  const transactions = [{ type: "opening-float" as const, amountCents: 5000 }];
  assert.throws(() => createFinanceReconciliationWrite("Cubs", transactions, 4900, ""), /note/);
  assert.equal(createFinanceReconciliationWrite("Cubs", transactions, 4900, " Cash tin short by one euro ").note, "Cash tin short by one euro");
});

test("corrections are represented by linked adjustment transactions", () => {
  const original: FinanceTransaction = {
    id: "txn-1",
    section: "Cubs",
    type: "expense",
    amountCents: 1299,
    category: "Programme materials",
    description: "Craft supplies",
    transactionDate: "2026-08-30",
    sourceTransactionId: "",
    reversalOfTransactionId: "",
    createdBy: "leader-1"
  };

  const reversal = createReversalInput(original, "2026-08-31");
  assert.equal(reversal.type, "adjustment");
  assert.equal(reversal.amountCents, 1299);
  assert.equal(reversal.reversalOfTransactionId, "txn-1");
  assert.equal(calculateLedgerBalanceCents([original, reversal]), 0);
});

test("validates normalized transaction details and whole-cent storage", () => {
  const validated = validateFinanceTransactionInput({
    section: "  Beaver   Scouts ",
    type: "income",
    amountCents: 2500,
    category: " Float   top up ",
    description: " Float   top up ",
    transactionDate: "2026-08-30",
    sourceTransactionId: " ",
    reversalOfTransactionId: ""
  });

  assert.equal(validated.section, "Beaver Scouts");
  assert.equal(validated.category, "Float top up");
  assert.equal(validated.description, "Float top up");
  assert.throws(() => validateFinanceTransactionInput({ ...validated, amountCents: 12.5 }), /whole cents/);
});

test("adjustments require a correction link and cannot be zero", () => {
  const base = {
    section: "Scouts",
    type: "adjustment" as const,
    amountCents: -500,
    category: "Other",
    description: "Correction",
    transactionDate: "2026-08-30",
    sourceTransactionId: ""
  };

  assert.throws(() => validateFinanceTransactionInput({ ...base, reversalOfTransactionId: "" }), /reference/);
  assert.throws(() => validateFinanceTransactionInput({ ...base, amountCents: 0, reversalOfTransactionId: "txn-2" }), /non-zero/);
});
