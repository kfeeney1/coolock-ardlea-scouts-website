import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../src/pages/PolicyDocuments.tsx", import.meta.url), "utf8");
const docs = readFileSync(new URL("../../docs/policy-document-publication.md", import.meta.url), "utf8");

test("file selection is separate from explicit publication", () => {
  assert.match(page, /"Choose PDF"/);
  assert.match(page, /Publish document/);
  assert.match(docs, /Selecting a file is not itself a Storage write/);
});
