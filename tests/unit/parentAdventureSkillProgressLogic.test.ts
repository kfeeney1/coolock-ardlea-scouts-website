import assert from "node:assert/strict";
import test from "node:test";

import { adventureSkillsById } from "../../src/data/adventureSkills/index.ts";
import { parentAdventureSkillSummaries } from "../../src/services/parentAdventureSkillProgressLogic.ts";
import type { MemberAdventureProgress } from "../../src/services/adventureSkillProgress.ts";

function progress(requirementIds: string[], awards: Array<{ skillId: string; stage: number }> = []): MemberAdventureProgress {
  return {
    memberId: "member-1",
    requirements: requirementIds.map((requirementId) => ({
      requirementId,
      skillId: requirementId.split("-stage-")[0],
      stage: 1,
      sharedCompetencyKey: requirementId.includes("requirement-06") ? "buddy-system" : "",
      completedAt: null,
      completedBy: "leader-1",
      sourceType: "manual",
      sourceId: ""
    })),
    awards: awards.map(({ skillId, stage }) => ({
      id: `${skillId}-stage-${stage}`,
      skillId,
      stage,
      awardedAt: null,
      awardedBy: "leader-1"
    }))
  };
}

test("parent summaries keep requirements complete separate from awarded", () => {
  const campingStage1 = adventureSkillsById.get("camping")!.stages.find((stage) => stage.stage === 1)!;
  const summary = parentAdventureSkillSummaries(progress(campingStage1.requirements.map((requirement) => requirement.id)))
    .find((skill) => skill.skillId === "camping")!;

  assert.equal(summary.stages[0].requirementsComplete, true);
  assert.equal(summary.stages[0].awarded, false);
  assert.equal(summary.completedStages, 1);
  assert.equal(summary.awardedStages, 0);
});

test("parent summaries show awarded stages independently", () => {
  const summary = parentAdventureSkillSummaries(progress([], [{ skillId: "camping", stage: 1 }]))
    .find((skill) => skill.skillId === "camping")!;

  assert.equal(summary.stages[0].requirementsComplete, false);
  assert.equal(summary.stages[0].awarded, true);
  assert.equal(summary.awardedStages, 1);
});

test("parent stage detail exposes competency statements with completed and outstanding states", () => {
  const campingStage1 = adventureSkillsById.get("camping")!.stages.find((stage) => stage.stage === 1)!;
  const completedId = campingStage1.requirements[0].id;
  const summary = parentAdventureSkillSummaries(progress([completedId]))
    .find((skill) => skill.skillId === "camping")!;
  const stage = summary.stages[0];

  assert.equal(stage.requirements.length, campingStage1.requirements.length);
  assert.deepEqual(
    stage.requirements.map((requirement) => requirement.statement),
    campingStage1.requirements.map((requirement) => requirement.statement)
  );
  assert.equal(stage.requirements.find((requirement) => requirement.requirementId === completedId)?.completed, true);
  assert.equal(stage.requirements.some((requirement) => !requirement.completed), true);
});

test("shared Buddy System credit is reflected in parent competency detail across linked skills", () => {
  const summaries = parentAdventureSkillSummaries(progress(["camping-stage-1-requirement-06"]));
  const camping = summaries.find((skill) => skill.skillId === "camping")!;
  const hillwalking = summaries.find((skill) => skill.skillId === "hillwalking")!;

  assert.equal(camping.stages[0].completedRequirements >= 1, true);
  assert.equal(hillwalking.stages[0].completedRequirements >= 1, true);
  assert.equal(camping.stages[0].requirements.find((requirement) => requirement.requirementId === "camping-stage-1-requirement-06")?.completed, true);
  assert.equal(hillwalking.stages[0].requirements.some((requirement) => requirement.completed), true);
});

test("Swimming parent progress exposes six stages only", () => {
  const swimming = parentAdventureSkillSummaries(progress([])).find((skill) => skill.skillId === "swimming")!;
  assert.equal(swimming.stageCount, 6);
  assert.deepEqual(swimming.stages.map((stage) => stage.stage), [1, 2, 3, 4, 5, 6]);
});
