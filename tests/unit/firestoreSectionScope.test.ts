import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Firestore section access remains bound to persisted canonical account sections", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const start = rules.indexOf("function hasSection(section)");
  const end = rules.indexOf("function isYouthSection", start);
  const helper = rules.slice(start, end);
  assert.match(helper, /section in profile\(\)\.sections/);
  assert.doesNotMatch(helper, /organisationLeadership|appointments/);
});

test("appointment-derived operational scope is projected by application logic without expanding rules cost", () => {
  const scope = readFileSync("src/services/leaderAccessLogic.ts", "utf8");
  assert.match(scope, /effectiveOperationalSections/);
  assert.match(scope, /appointment\.scope/);
});
