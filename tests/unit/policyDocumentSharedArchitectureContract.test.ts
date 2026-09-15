import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const docs = readFileSync(new URL("../../docs/policy-document-publication.md", import.meta.url), "utf8");

test("policy catalogue stays in the shared application rather than an Android-only implementation", () => {
  assert.match(app, /const PolicyDocuments = lazy/);
  assert.match(docs, /existing Firebase Storage attachment boundary/);
  assert.doesNotMatch(docs, /Android-only/i);
});
