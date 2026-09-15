import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const docs = readFileSync(new URL("../../docs/policy-document-publication.md", import.meta.url), "utf8");

test("SW-77 explicitly reuses rather than duplicates storage architecture", () => {
  assert.match(docs, /reuses the existing Firebase Storage attachment boundary/);
  assert.match(docs, /does not add .* second generic file service/i);
});
