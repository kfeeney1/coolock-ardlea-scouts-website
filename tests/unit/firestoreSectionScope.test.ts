import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Firestore section access remains bound to persisted canonical account sections", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const profileHelper = rules.match(/function profileHasSection\(section\) \{[\s\S]*?^ {4,6}\}/m)?.[0] ?? "";
  const helper = rules.match(/function hasSection\(section\) \{[\s\S]*?^ {4,6}\}/m)?.[0] ?? "";

  assert.match(profileHelper, /let sections = profile\(\)\.sections/);
  assert.match(profileHelper, /section in sections/);
  assert.match(helper, /profileHasSection\(section\)/);
  assert.doesNotMatch(profileHelper + helper, /organisationLeadership|appointments/);
});
