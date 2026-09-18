import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../src/pages/PolicyDocuments.tsx", import.meta.url), "utf8");
const service = readFileSync(new URL("../../src/services/policyDocuments.ts", import.meta.url), "utf8");

test("policy managers can deliberately replace an existing current document", () => {
  assert.match(page, /Publication mode/);
  assert.match(page, /Replace: \{item\.title\}/);
  assert.match(page, /documentId: replaceDocumentId \|\| undefined/);
  assert.match(service, /transaction\.get\(metadataRef\)/);
  assert.match(service, /previousVersions\.push/);
});
