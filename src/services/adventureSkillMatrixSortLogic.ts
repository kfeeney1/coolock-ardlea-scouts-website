import type { AdventureSkillOverview, AdventureStageOverviewStatus } from "./adventureSkillOverviewLogic.ts";

const statusProgressRank: Record<AdventureStageOverviewStatus, number> = {
  "not-started": 0,
  "in-progress": 1,
  "requirements-complete": 2,
  awarded: 3
};

export function compareAdventureSkillMatrixProgress(left: AdventureSkillOverview, right: AdventureSkillOverview) {
  if (left.highestAwardedStage !== right.highestAwardedStage) return right.highestAwardedStage - left.highestAwardedStage;
  if (left.nextStage !== right.nextStage) return right.nextStage - left.nextStage;

  const leftStage = left.stages.find((stage) => stage.stage === left.nextStage) ?? left.stages.at(-1)!;
  const rightStage = right.stages.find((stage) => stage.stage === right.nextStage) ?? right.stages.at(-1)!;
  const statusDifference = statusProgressRank[rightStage.status] - statusProgressRank[leftStage.status];
  if (statusDifference !== 0) return statusDifference;

  const leftRatio = leftStage.totalRequirements === 0 ? 0 : leftStage.completedRequirements / leftStage.totalRequirements;
  const rightRatio = rightStage.totalRequirements === 0 ? 0 : rightStage.completedRequirements / rightStage.totalRequirements;
  if (leftRatio !== rightRatio) return rightRatio - leftRatio;

  const leftCompleted = left.stages.reduce((total, stage) => total + stage.completedRequirements, 0);
  const rightCompleted = right.stages.reduce((total, stage) => total + stage.completedRequirements, 0);
  return rightCompleted - leftCompleted;
}
