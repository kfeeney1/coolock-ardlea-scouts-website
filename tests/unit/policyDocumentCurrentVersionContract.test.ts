import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../../src/services/policyDocuments.ts", import.meta.url), "utf8");
const storageRules = readFileSync(new URL("../../storage.rules", import.meta.url), "utf8");

test("Firestore metadata selects the current policy version and Storage enforces that pointer", () => {
  assert.match(service, /where\("state", "==", "current"\)/);
  assert.match(service, /versionId: item\.versionId/);
  assert.match(service, /effectiveDate: item\.effectiveDate/);
  assert.match(service, /previousVersions/);
  assert.match(storageRules, /policyMetadata\(documentId\).*versionId/s);
});
