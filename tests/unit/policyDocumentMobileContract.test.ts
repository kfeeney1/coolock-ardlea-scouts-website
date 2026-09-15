import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../src/pages/PolicyDocuments.tsx", import.meta.url), "utf8");

test("policy catalogue uses a phone-first responsive card grid", () => {
  assert.match(page, /gridTemplateColumns: \{ xs: "1fr", md: "repeat\(2, minmax\(0, 1fr\)\)" \}/);
  assert.doesNotMatch(page, /<Table/);
});
