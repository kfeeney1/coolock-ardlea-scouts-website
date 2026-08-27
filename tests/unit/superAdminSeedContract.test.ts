import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const seedSource = readFileSync("scripts/seed-population-data.mjs", "utf8");

test("canonical super-admin seed keeps the established login email", () => {
  assert.match(seedSource, /uid:\s*"TEST_uid_super_admin_01"[\s\S]*?email:\s*"superadmin@example\.com"/);
  assert.doesNotMatch(seedSource, /email:\s*"test\.superadmin@example\.com"/);
});
