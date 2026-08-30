import assert from "node:assert/strict";
import test from "node:test";
import { validateFinanceTransferInput } from "../../src/services/financeTransferLogic.ts";

test("valid finance transfer input is normalised", () => {
  assert.deepEqual(validateFinanceTransferInput({
    fromSection: "  Cubs ",
    toSection: "Scouts  ",
    amountCents: 1250,
    description: "  Camp   float  ",
    transactionDate: "2026-08-30",
  }), {
    fromSection: "Cubs",
    toSection: "Scouts",
    amountCents: 1250,
    description: "Camp float",
    transactionDate: "2026-08-30",
  });
});

test("finance transfer requires two different sections", () => {
  assert.throws(() => validateFinanceTransferInput({
    fromSection: "Cubs",
    toSection: "Cubs",
    amountCents: 500,
    description: "Move cash",
    transactionDate: "2026-08-30",
  }), /different sections/);
});

test("finance transfer rejects invalid amounts and dates", () => {
  assert.throws(() => validateFinanceTransferInput({
    fromSection: "Cubs",
    toSection: "Scouts",
    amountCents: 10.5,
    description: "Move cash",
    transactionDate: "2026-08-30",
  }), /whole number of cents/);
  assert.throws(() => validateFinanceTransferInput({
    fromSection: "Cubs",
    toSection: "Scouts",
    amountCents: 500,
    description: "Move cash",
    transactionDate: "30-08-2026",
  }), /YYYY-MM-DD/);
});
