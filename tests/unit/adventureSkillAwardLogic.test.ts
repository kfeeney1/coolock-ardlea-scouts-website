import test from "node:test";
import assert from "node:assert/strict";

import { membersWithIncompleteStage, requirementProvenance, stageAwardSelectionState } from "../../src/services/adventureSkillAwardLogic.ts";
import type { MemberAdventureProgress } from "../../src/services/adventureSkillProgress.ts";
import { requirementIdsForStage } from "../../src/services/adventureSkillProgressLogic.ts";

function progress(memberId: string, requirementIds: string[] = [], awarded = false): MemberAdventureProgress {
  return {
    memberId,
    requirements: requirementIds.map((requirementId, index) => ({
      requirementId,
      skillId: requirementId.split("-stage-")[0],
      stage: 1,
      sharedCompetencyKey: requirementId.includes("requirement-06") ? "buddy-system" : "",
      completedAt: new Date(2026, 7, 28, 10, index),
      completedBy: "leader-1",
      sourceType: index % 2 === 0 ? "manual" : "weeklyMeeting",
      sourceId: index % 2 === 0 ? "" : "meeting-1"
    })),
    awards: awarded ? [{ id: "camping-stage-1", skillId: "camping", stage: 1, awardedAt: new Date(2026, 7, 28), awardedBy: "leader-1" }] : []
  };
}

test("award selection distinguishes none, some and all", () => {
  const map = new Map<string, MemberAdventureProgress>([
    ["a", progress("a", [], true)],
    ["b", progress("b")]
  ]);
  assert.equal(stageAwardSelectionState(["b"], map, "camping", 1), "none");
  assert.equal(stageAwardSelectionState(["a", "b"], map, "camping", 1), "some");
  assert.equal(stageAwardSelectionState(["a"], map, "camping", 1), "all");
});

test("award gating requires every persisted stage requirement for every selected member", () => {
  const campingStageOne = requirementIdsForStage("camping", 1);
  const map = new Map<string, MemberAdventureProgress>([
    ["complete", progress("complete", campingStageOne)],
    ["incomplete", progress("incomplete", campingStageOne.slice(0, -1))]
  ]);
  assert.deepEqual(membersWithIncompleteStage(["complete"], map, "camping", 1), []);
  assert.deepEqual(membersWithIncompleteStage(["complete", "incomplete"], map, "camping", 1), ["incomplete"]);
});

test("provenance resolves an explicitly equivalent shared competency", () => {
  const linked = progress("a", ["hillwalking-stage-1-requirement-09"]);
  const record = requirementProvenance(linked, "camping-stage-1-requirement-06");
  assert.equal(record?.requirementId, "hillwalking-stage-1-requirement-09");
});
