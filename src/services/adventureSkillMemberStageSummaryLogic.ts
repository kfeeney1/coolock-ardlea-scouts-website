import type { AdventureSkill, AdventureSkillStage } from "../data/adventureSkills/index.ts";
import type { MemberAdventureProgress } from "./adventureSkillProgress.ts";
import { isStageRequirementComplete } from "./adventureSkillProgressLogic.ts";

export type MemberStageSummaryStatus = "not-started" | "in-progress" | "requirements-complete" | "awarded";

export type MemberStageSummary = {
  memberId: string;
  completedRequirements: number;
  totalRequirements: number;
  status: MemberStageSummaryStatus;
};

export function memberStageSummary(
  memberId: string,
  progress: MemberAdventureProgress | undefined,
  skill: AdventureSkill,
  stage: AdventureSkillStage
): MemberStageSummary {
  const completedIds = new Set(progress?.requirements.map((requirement) => requirement.requirementId) ?? []);
  const completedRequirements = stage.requirements.filter((requirement) =>
    isStageRequirementComplete(completedIds, requirement.id)
  ).length;
  const awarded = progress?.awards.some((award) => award.skillId === skill.id && award.stage === stage.stage) ?? false;
  const status: MemberStageSummaryStatus = awarded
    ? "awarded"
    : stage.requirements.length > 0 && completedRequirements === stage.requirements.length
      ? "requirements-complete"
      : completedRequirements > 0
        ? "in-progress"
        : "not-started";

  return {
    memberId,
    completedRequirements,
    totalRequirements: stage.requirements.length,
    status
  };
}

export function memberStageSummaryLabel(summary: MemberStageSummary): string {
  if (summary.status === "awarded") return "Awarded";
  if (summary.status === "requirements-complete") return "Awaiting award";
  if (summary.status === "not-started") return `0/${summary.totalRequirements} points`;
  return `${summary.completedRequirements}/${summary.totalRequirements} points`;
}
