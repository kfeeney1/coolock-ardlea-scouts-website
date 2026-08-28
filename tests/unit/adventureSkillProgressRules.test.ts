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
  assert.match(rules, /request\.resource\.data\.requirementId == requirementId/);
  assert.match(rules, /request\.resource\.data\.completedBy == request\.auth\.uid/);
  assert.match(rules, /request\.resource\.data\.sourceType in \["manual", "weeklyMeeting", "event", "activity", "migration"\]/);
  assert.match(rules, /request\.resource\.data\.stage >= 1/);
  assert.match(rules, /request\.resource\.data\.stage <= 9/);
});

test("awards remain separate from requirement completion and use stable document IDs", () => {
  assert.match(rules, /match \/awards\/\{awardId\}/);
  assert.match(rules, /awardId == request\.resource\.data\.skillId \+ "-stage-" \+ request\.resource\.data\.stage/);
  assert.match(rules, /request\.resource\.data\.awardedBy == request\.auth\.uid/);
});
