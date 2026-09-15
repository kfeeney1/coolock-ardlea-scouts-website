import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../src/pages/PolicyDocuments.tsx", import.meta.url), "utf8");

test("catalogue presents title, category, description, audience and effective version date", () => {
  assert.match(page, /item\.title/);
  assert.match(page, /item\.category/);
  assert.match(page, /item\.description/);
  assert.match(page, /item\.audience/);
  assert.match(page, /item\.effectiveDate/);
});
