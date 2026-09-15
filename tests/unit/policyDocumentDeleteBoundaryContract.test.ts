import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rules = readFileSync(new URL("../../storage.rules", import.meta.url), "utf8");

test("ordinary parents and leaders cannot delete policy objects", () => {
  assert.match(rules, /allow delete: if canManagePolicies\(\) && resource\.metadata\.ownerType == "policy-document"/);
});
