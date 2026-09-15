import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../src/pages/PolicyDocuments.tsx", import.meta.url), "utf8");

test("policy catalogue communicates state without colour-only semantics", () => {
  assert.match(page, /label="Current"/);
  assert.match(page, /label={item\.audience}/);
  assert.match(page, /aria-live="polite"/);
});

test("policy actions have visible accessible names and confirmation", () => {
  assert.match(page, />Open PDF</);
  assert.match(page, />Withdraw</);
  assert.match(page, /DialogTitle id="withdraw-policy-title"/);
});
