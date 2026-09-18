import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../../src/services/policyDocuments.ts", import.meta.url), "utf8");

test("published policy metadata records lifecycle and ownership context", () => {
  for (const field of ["documentId", "versionId", "title", "description", "category", "audience", "effectiveDate", "sourceOwner", "storagePath", "state", "publishedBy", "publishedAt", "previousVersions"]) {
    assert.match(service, new RegExp(`${field}:`));
  }
});

test("withdrawal is non-destructive pending SW-80 and records audit", () => {
  assert.match(service, /state: "withdrawn"/);
  assert.match(service, /withdrawnBy/);
  assert.match(service, /action: "policy-withdrawn"/);
  assert.match(service, /action: "policy-published"/);
  assert.doesNotMatch(service, /deleteObject\(ref\(storage, document\.storagePath\)\)/);
});
