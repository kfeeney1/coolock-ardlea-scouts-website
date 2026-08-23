import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const guardedFiles = [
  "scripts/seed-e2e-auth-users.mjs",
  "e2e/organisation-chart.spec.ts"
];

const forbiddenLegacyIdentifiers = [
  "test.admin@example.com",
  "TEST_uid_admin_01"
];

test("legacy admin fixture cannot be reintroduced into active E2E data", () => {
  for (const path of guardedFiles) {
    const content = readFileSync(path, "utf8");
    for (const value of forbiddenLegacyIdentifiers) {
      assert.equal(content.includes(value), false, `${path} must not contain legacy fixture identifier ${value}`);
    }
  }
});
