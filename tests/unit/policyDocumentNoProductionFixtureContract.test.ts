import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const docs = readFileSync(new URL("../../docs/policy-document-publication.md", import.meta.url), "utf8");

test("policy automation is explicitly synthetic/non-production", () => {
  assert.match(docs, /No production documents are uploaded by CI or seed jobs/);
});
