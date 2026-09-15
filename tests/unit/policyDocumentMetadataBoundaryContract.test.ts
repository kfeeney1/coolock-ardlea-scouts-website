import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rules = readFileSync(new URL("../../storage.rules", import.meta.url), "utf8");

test("clients cannot mutate policy access metadata after publication", () => {
  const policyBlock = rules.slice(rules.indexOf("match /attachments/policy-documents"));
  assert.match(policyBlock, /allow update: if false/);
});
