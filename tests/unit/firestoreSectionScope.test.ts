import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Firestore section access recognises canonical active section appointments", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  assert.match(rules, /function hasSectionAppointment\(section\)/);
  assert.match(rules, /get\("scope", ""\) == section/);
  assert.match(rules, /get\("active", true\) == true/);
  assert.match(rules, /"Section Leader", "Assistant Section Leader", "Programme Scouter", "Scouter"/);
  assert.match(rules, /section in profile\(\)\.sections\s*\n\s*\|\| hasSectionAppointment\(section\)/);
});

test("group-scoped appointments do not become section grants", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const start = rules.indexOf("function sectionAppointmentAt");
  const end = rules.indexOf("function hasSection(section)", start);
  const helper = rules.slice(start, end);
  assert.doesNotMatch(helper, /Group Trainer|Group Treasurer|Group Secretary|Group Quartermaster/);
});
