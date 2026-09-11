import assert from "node:assert/strict";
import test from "node:test";
import { numericInputDisplayValue, parseOptionalNumberInput } from "../../src/services/numericInput";

test("numeric input preserves a temporary empty value instead of coercing it to zero", () => {
  assert.equal(parseOptionalNumberInput(""), null);
  assert.equal(numericInputDisplayValue(null), "");
});

test("numeric input parses replacement values as numbers without retaining a leading zero", () => {
  assert.equal(parseOptionalNumberInput("5"), 5);
  assert.equal(parseOptionalNumberInput("10"), 10);
});

test("numeric input does not accept non-finite numeric text", () => {
  assert.equal(parseOptionalNumberInput("not-a-number"), null);
});
