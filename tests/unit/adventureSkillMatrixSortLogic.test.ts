import assert from "node:assert/strict";
import test from "node:test";

import { compareAdventureSkillMatrixProgress } from "../../src/services/adventureSkillMatrixSortLogic.ts";
import type { AdventureSkillOverview, AdventureStageOverview } from "../../src/services/adventureSkillOverviewLogic.ts";

function summary(stages: AdventureStageOverview[], highestAwardedStage = 0, nextStage = 1): AdventureSkillOverview {
  return {
    skillId: "camping",
    skillName: "Camping",
    stages,
    highestAwardedStage,
    nextStage,
    status: stages.find((stage) => stage.stage === nextStage)?.status ?? "not-started"
  };
}

function stage(stageNumber: number, completedRequirements: number, totalRequirements: number, status: AdventureStageOverview["status"]): AdventureStageOverview {
  return { stage: stageNumber, completedRequirements, totalRequirements, status };
}

test("matrix progress sorts higher awarded levels before lower progress", () => {
  const stageTwo = summary([
    stage(1, 4, 4, "awarded"),
    stage(2, 1, 4, "in-progress")
  ], 1, 2);
  const stageOne = summary([
    stage(1, 4, 4, "requirements-complete"),
    stage(2, 0, 4, "not-started")
  ]);

  assert.ok(compareAdventureSkillMatrixProgress(stageTwo, stageOne) < 0);
});

test("matrix progress sorts awaiting award before partial progress at the same level", () => {
  const awaiting = summary([stage(1, 4, 4, "requirements-complete")]);
  const partial = summary([stage(1, 3, 4, "in-progress")]);

  assert.ok(compareAdventureSkillMatrixProgress(awaiting, partial) < 0);
});

test("matrix progress uses completion ratio within the same active level", () => {
  const threeQuarters = summary([stage(1, 3, 4, "in-progress")]);
  const half = summary([stage(1, 2, 4, "in-progress")]);

  assert.ok(compareAdventureSkillMatrixProgress(threeQuarters, half) < 0);
  assert.equal(compareAdventureSkillMatrixProgress(half, half), 0);
});
