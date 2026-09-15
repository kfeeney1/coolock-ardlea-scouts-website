import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../../src/services/policyDocuments.ts", import.meta.url), "utf8");

test("published policy metadata records lifecycle and ownership context", () => {
  for (const field of ["ownerType", "documentId", "versionId", "title", "description", "category", "audience", "effectiveDate", "sourceOwner", "state", "publishedBy", "publishedAt", "originalFileName"]) {
    assert.match(service, new RegExp(`${field}:`));
  }
});

test("withdrawal removes only the selected published artefact and records audit", () => {
  assert.match(service, /deleteObject\(ref\(storage, document\.storagePath\)\)/);
  assert.match(service, /action: "policy-withdrawn"/);
  assert.match(service, /action: "policy-published"/);
});
