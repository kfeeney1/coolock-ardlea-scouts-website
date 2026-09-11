import { describe, expect, it } from "vitest";
import { numericInputDisplayValue, parseOptionalNumberInput } from "../../src/services/numericInput";

describe("numeric input editing", () => {
  it("preserves a temporary empty value instead of coercing it to zero", () => {
    expect(parseOptionalNumberInput("")).toBeNull();
    expect(numericInputDisplayValue(null)).toBe("");
  });

  it("parses replacement values as numbers without retaining a leading zero", () => {
    expect(parseOptionalNumberInput("5")).toBe(5);
    expect(parseOptionalNumberInput("10")).toBe(10);
  });

  it("does not accept non-finite numeric text", () => {
    expect(parseOptionalNumberInput("not-a-number")).toBeNull();
  });
});
