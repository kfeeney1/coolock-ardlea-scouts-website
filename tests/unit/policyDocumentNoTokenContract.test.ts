import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../../src/services/policyDocuments.ts", import.meta.url), "utf8");

test("restricted policy viewing does not persist Firebase download URLs", () => {
  assert.doesNotMatch(service, /getDownloadURL|firebaseStorageDownloadTokens/);
  assert.match(service, /getBlob/);
});
