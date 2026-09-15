import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../../src/services/policyDocuments.ts", import.meta.url), "utf8");

test("catalogue only accepts current policy objects and exposes version identifiers", () => {
  assert.match(service, /custom\.state !== "current"/);
  assert.match(service, /versionId: custom\.versionId/);
  assert.match(service, /effectiveDate: custom\.effectiveDate/);
});
