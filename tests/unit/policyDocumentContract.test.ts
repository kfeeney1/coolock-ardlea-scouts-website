import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const storageRules = readFileSync(new URL("../../storage.rules", import.meta.url), "utf8");
const service = readFileSync(new URL("../../src/services/policyDocuments.ts", import.meta.url), "utf8");

test("policy documents reuse the existing attachment namespace with explicit audience rules", () => {
  assert.match(service, /attachments\/policy-documents\/current/);
  assert.match(storageRules, /canReadPolicyAudience/);
  assert.match(storageRules, /audience == "public"/);
  assert.match(storageRules, /audience == "parent" && isApprovedParent/);
  assert.match(storageRules, /audience == "leader" && isActiveLeader/);
  assert.match(storageRules, /audience == "admin" && canManagePolicies/);
});

test("disabled or merely authenticated accounts do not receive restricted authenticated documents", () => {
  assert.match(storageRules, /audience == "authenticated" && \(isActiveLeader\(\) \|\| isApprovedParent\(\)\)/);
  assert.doesNotMatch(storageRules, /audience == "authenticated" && signedIn\(\)/);
});

test("publication accepts only bounded PDFs and does not create persistent download token URLs", () => {
  assert.match(storageRules, /request\.resource\.size <= 10 \* 1024 \* 1024/);
  assert.match(storageRules, /request\.resource\.contentType == "application\/pdf"/);
  assert.match(service, /getBlob/);
  assert.match(service, /URL\.createObjectURL/);
  assert.doesNotMatch(service, /getDownloadURL/);
});
