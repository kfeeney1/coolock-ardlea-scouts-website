import test from "node:test";
import assert from "node:assert/strict";

import { memberRequirementCompletion } from "../../src/services/adventureSkillMemberDraftLogic.ts";
import type { MemberAdventureProgress } from "../../src/services/adventureSkillProgress.ts";

const progress: MemberAdventureProgress = {
  memberId: "member-1",
  requirements: [{
    requirementId: "camping-stage-1-1",
    skillId: "camping",
    stage: 1,
    sharedCompetencyKey: "",
    completedAt: null,
    completedBy: "leader-1",
    sourceType: "manual",
    sourceId: ""
  }],
  awards: []
};

test("memberRequirementCompletion reports saved completion for the child", () => {
  assert.equal(memberRequirementCompletion(progress, "camping-stage-1-1"), true);
});

test("memberRequirementCompletion reports missing competency for the child", () => {
  assert.equal(memberRequirementCompletion(progress, "camping-stage-1-2"), false);
});

test("memberRequirementCompletion handles unloaded progress safely", () => {
  assert.equal(memberRequirementCompletion(undefined, "camping-stage-1-1"), false);
});
