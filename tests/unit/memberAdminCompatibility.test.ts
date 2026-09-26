import assert from "node:assert/strict";
import test from "node:test";

import { automaticDisplayName, canonicalMemberSection } from "../../src/services/memberIdentityLogic.ts";

test("member section compatibility maps Venture storage aliases to the canonical filter", () => {
  for (const value of ["Venture", "Ventures", "Venture Scout", "Venture Scouts"]) {
    assert.equal(canonicalMemberSection(value), "Ventures");
  }
  assert.equal(canonicalMemberSection("Other"), "Other");
});

test("automatic member display names preserve valid surname punctuation", () => {
  assert.equal(automaticDisplayName("Áine", "O'Neill-Smith"), "Áine O'Neill-Smith");
});
