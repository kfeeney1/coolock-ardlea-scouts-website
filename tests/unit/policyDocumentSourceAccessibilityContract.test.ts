import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const docs = readFileSync(new URL("../../docs/policy-document-publication.md", import.meta.url), "utf8");

test("catalogue accessibility does not claim source PDFs are accessible", () => {
  assert.match(docs, /does not claim that the source PDF itself is accessible/);
});
