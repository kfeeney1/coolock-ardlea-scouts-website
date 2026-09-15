import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../../src/services/policyDocuments.ts", import.meta.url), "utf8");

test("meaningful policy lifecycle actions use existing audit architecture", () => {
  assert.match(service, /recordAuditEvent/);
  assert.match(service, /policy-published/);
  assert.match(service, /policy-withdrawn/);
  assert.doesNotMatch(service, /policy-viewed/);
});
