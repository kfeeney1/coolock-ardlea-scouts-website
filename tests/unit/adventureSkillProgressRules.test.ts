import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");

test("Adventure Skills progress is member-owned and parents are read-only", () => {
  assert.match(rules, /match \/memberAdventureSkillProgress\/\{memberId\}/);
  assert.match(rules, /allow get, list: if isApprovedParentForMember\(memberId\)/);
  assert.match(rules, /exists\(\/databases\/\$\(database\)\/documents\/members\/\$\(memberId\)\)/);
  assert.doesNotMatch(rules, /memberAdventureSkillProgress[^]*allow create, update: if isApprovedParentForMember/);
});

test("requirement writes are attributed, source-aware and bounded to catalogue stage numbers", () => {
  assert.match(rules, /_writeData\.requirementId == requirementId/);
  assert.match(rules, /_writeData\.completedBy == request\.auth\.uid/);
  assert.match(rules, /_writeData\.sourceType in \["manual", "weeklyMeeting", "event", "activity", "migration"\]/);
  assert.match(rules, /_writeData\.stage >= 1/);
  assert.match(rules, /_writeData\.stage <= 9/);
});

test("awards remain separate from requirement completion and use stable document IDs", () => {
  assert.match(rules, /match \/awards\/\{awardId\}/);
  assert.match(rules, /_writeData\.awardId == awardId/);
  assert.match(rules, /_writeData\.keys\(\)\.hasOnly\(\["awardId", "memberId", "skillId", "stage", "awardedAt", "awardedBy"\]\)/);
  assert.match(rules, /_writeData\.awardedBy == request\.auth\.uid/);
});
