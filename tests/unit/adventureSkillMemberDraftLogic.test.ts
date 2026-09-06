import test from "node:test";
import assert from "node:assert/strict";

import {
  clearMemberRequirementDraftForRequirement,
  memberRequirementCompletion,
  memberRequirementDraftChanges,
  memberRequirementDraftCompletion,
  memberRequirementDraftKey,
  setMemberRequirementDraft
} from "../../src/services/adventureSkillMemberDraftLogic.ts";
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

test("member-specific draft overrides the supplied baseline", () => {
  const draft = setMemberRequirementDraft(new Map(), "member-1", missingRequirementId, true, false);
  assert.equal(memberRequirementDraftCompletion(draft, "member-1", missingRequirementId, false), true);
  assert.equal(memberRequirementDraftCompletion(draft, "member-2", missingRequirementId, false), false);
});

test("member-specific draft removes an override when it matches the baseline", () => {
  const initial = new Map([[memberRequirementDraftKey("member-1", missingRequirementId), true]]);
  const draft = setMemberRequirementDraft(initial, "member-1", missingRequirementId, false, false);
  assert.equal(draft.size, 0);
});

test("bulk competency changes can clear only their child-specific overrides", () => {
  const draft = new Map([
    [memberRequirementDraftKey("member-1", completedRequirementId), false],
    [memberRequirementDraftKey("member-1", missingRequirementId), true],
    [memberRequirementDraftKey("member-2", completedRequirementId), false]
  ]);
  const cleared = clearMemberRequirementDraftForRequirement(draft, completedRequirementId);
  assert.deepEqual([...cleared.entries()], [[memberRequirementDraftKey("member-1", missingRequirementId), true]]);
});

test("member-specific draft changes parse into deterministic save operations", () => {
  const draft = new Map([
    [memberRequirementDraftKey("member-1", completedRequirementId), false],
    [memberRequirementDraftKey("member-2", missingRequirementId), true]
  ]);
  assert.deepEqual(memberRequirementDraftChanges(draft), [
    { memberId: "member-1", requirementId: completedRequirementId, completed: false },
    { memberId: "member-2", requirementId: missingRequirementId, completed: true }
  ]);
});
