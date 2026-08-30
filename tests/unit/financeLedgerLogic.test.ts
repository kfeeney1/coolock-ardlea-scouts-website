import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateLedgerBalanceCents,
  createFinanceReconciliationWrite,
  createReversalInput,
  reconcileFinanceFloat,
  validateFinanceTransactionInput,
  type FinanceTransaction
} from "../../src/services/financeLedgerLogic.ts";

test("calculates a section float from immutable ledger entries", () => {
  assert.equal(calculateLedgerBalanceCents([
    { type: "opening-float", amountCents: 5000 },
    { type: "income", amountCents: 2400 },
    { type: "expense", amountCents: 1750 },
    { type: "transfer-in", amountCents: 1000 },
    { type: "transfer-out", amountCents: 500 }
  ]), 6150);
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
    category: " Weekly   subs ",
    description: " Cash   collected ",
    transactionDate: "2026-08-30",
    sourceTransactionId: " ",
    reversalOfTransactionId: ""
  });

  assert.equal(validated.section, "Beaver Scouts");
  assert.equal(validated.category, "Weekly subs");
  assert.equal(validated.description, "Cash collected");
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
