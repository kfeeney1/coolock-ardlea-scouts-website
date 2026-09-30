import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Firestore section access remains bound to persisted canonical account sections", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const profileStart = rules.indexOf("function profileHasSection(section)");
  const start = rules.indexOf("function hasSection(section)");
  const end = rules.indexOf("function isYouthSection", start);
  const profileHelper = rules.slice(profileStart, start);
  const helper = rules.slice(start, end);

  assert.match(profileHelper, /section in profile\(\)\.sections/);
  assert.match(helper, /profileHasSection\(section\)/);
  assert.doesNotMatch(profileHelper + helper, /organisationLeadership|appointments/);
});
