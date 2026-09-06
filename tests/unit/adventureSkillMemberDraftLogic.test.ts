import test from "node:test";
import assert from "node:assert/strict";

import { memberRequirementCompletion } from "../../src/services/adventureSkillMemberDraftLogic.ts";
import type { MemberAdventureProgress } from "../../src/services/adventureSkillProgress.ts";

const completedRequirementId = "camping-stage-1-requirement-01";
const missingRequirementId = "camping-stage-1-requirement-02";

const progress: MemberAdventureProgress = {
  memberId: "member-1",
  requirements: [{
    requirementId: completedRequirementId,
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
  assert.equal(memberRequirementCompletion(progress, completedRequirementId), true);
});

test("memberRequirementCompletion reports missing competency for the child", () => {
  assert.equal(memberRequirementCompletion(progress, missingRequirementId), false);
});

test("memberRequirementCompletion handles unloaded progress safely", () => {
  assert.equal(memberRequirementCompletion(undefined, completedRequirementId), false);
});
