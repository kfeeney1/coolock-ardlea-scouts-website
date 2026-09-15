import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const docs = readFileSync(new URL("../../docs/policy-document-publication.md", import.meta.url), "utf8");
const service = readFileSync(new URL("../../src/services/policyDocuments.ts", import.meta.url), "utf8");

test("SW-77 does not add a live Google Drive dependency or invent retention", () => {
  assert.match(docs, /does not add a live Google Drive dependency/i);
  assert.match(docs, /SW-80 has not approved a long-term retention duration/i);
  assert.doesNotMatch(service, /drive\.google|googleapis\.com\/drive/i);
});

test("temporary policy view URLs are explicitly revocable", () => {
  assert.match(service, /revokePolicyDocumentUrls/);
  assert.match(service, /URL\.revokeObjectURL/);
});
