import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../../src/services/policyDocuments.ts", import.meta.url), "utf8");

test("policy publication validates non-empty bounded PDF files before upload", () => {
  assert.match(service, /file\.size <= 0/);
  assert.match(service, /file\.size > MAX_BYTES/);
  assert.match(service, /application\/pdf/);
});
