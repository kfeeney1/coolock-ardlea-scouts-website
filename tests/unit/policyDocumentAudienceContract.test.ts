import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../../src/services/policyDocuments.ts", import.meta.url), "utf8");

test("policy audience vocabulary is small and explicit", () => {
  assert.match(service, /\["public", "authenticated", "parent", "leader", "admin"\] as const/);
});
