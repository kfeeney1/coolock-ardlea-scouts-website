import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../src/pages/PolicyDocuments.tsx", import.meta.url), "utf8");

test("withdrawal clearly describes what leaves the catalogue", () => {
  assert.match(page, /This removes .* from the current catalogue/);
  assert.match(page, /Withdraw policy document\?/);
  assert.match(page, />Cancel</);
});
