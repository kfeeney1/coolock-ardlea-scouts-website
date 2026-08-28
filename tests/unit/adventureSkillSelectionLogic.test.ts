import assert from "node:assert/strict";
import test from "node:test";

import { requirementSelectionState, selectedMemberSummary } from "../../src/services/adventureSkillSelectionLogic.ts";
import type { MemberAdventureProgress } from "../../src/services/adventureSkillProgress.ts";

function progress(memberId: string, requirementIds: string[]): MemberAdventureProgress {
  return {
    memberId,
    requirements: requirementIds.map((requirementId) => ({
      requirementId,
      skillId: requirementId.split("-stage-")[0],
      stage: 1,
      sharedCompetencyKey: requirementId.includes("requirement-06") ? "buddy-system" : "",
      completedAt: null,
      completedBy: "leader",
      sourceType: "manual",
      sourceId: ""
    })),
    awards: []
  };
}

test("requirement selection is all when every selected child has the point", () => {
  const byMember = new Map([
    ["a", progress("a", ["camping-stage-1-requirement-01"])],
    ["b", progress("b", ["camping-stage-1-requirement-01"])]
  ]);
  assert.equal(requirementSelectionState(["a", "b"], byMember, "camping-stage-1-requirement-01"), "all");
});

test("requirement selection is mixed when only some selected children have the point", () => {
  const byMember = new Map([
    ["a", progress("a", ["camping-stage-1-requirement-01"])],
    ["b", progress("b", [])]
  ]);
  assert.equal(requirementSelectionState(["a", "b"], byMember, "camping-stage-1-requirement-01"), "some");
});

test("shared competency counts an equivalent Buddy System requirement as complete", () => {
  const byMember = new Map([
    ["a", progress("a", ["paddling-stage-1-requirement-06"])]
  ]);
  assert.equal(requirementSelectionState(["a"], byMember, "camping-stage-1-requirement-06"), "all");
});

test("selection summary is useful for single, partial and all-visible selection", () => {
  assert.equal(selectedMemberSummary([], 5), "No children selected");
  assert.equal(selectedMemberSummary(["a"], 5), "1 child selected");
  assert.equal(selectedMemberSummary(["a", "b"], 5), "2 children selected");
  assert.equal(selectedMemberSummary(["a", "b"], 2), "All 2 children selected");
});
