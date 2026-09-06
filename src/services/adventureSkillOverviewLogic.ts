import { adventureSkills } from "../data/adventureSkills/index.ts";
import { isStageRequirementComplete } from "./adventureSkillProgressLogic.ts";
import type { MemberAdventureProgress } from "./adventureSkillProgress.ts";

export type AdventureStageOverviewStatus = "not-started" | "in-progress" | "requirements-complete" | "awarded";

export type AdventureStageOverview = {
  stage: number;
  completedRequirements: number;
  totalRequirements: number;
  status: AdventureStageOverviewStatus;
};

export type AdventureSkillOverview = {
  skillId: string;
  skillName: string;
  stages: AdventureStageOverview[];
  nextStage: number;
  highestAwardedStage: number;
  status: AdventureStageOverviewStatus;
};

export function adventureSkillOverview(progress: MemberAdventureProgress): AdventureSkillOverview[] {
  const completedIds = new Set(progress.requirements.map((requirement) => requirement.requirementId));
  const awards = new Set(progress.awards.map((award) => `${award.skillId}-stage-${award.stage}`));

  return adventureSkills.map((skill) => {
    const stages = skill.stages.map((stage): AdventureStageOverview => {
      const completedRequirements = stage.requirements.filter((requirement) =>
        isStageRequirementComplete(completedIds, requirement.id)
      ).length;
      const totalRequirements = stage.requirements.length;
      const awarded = awards.has(`${skill.id}-stage-${stage.stage}`);
      const status: AdventureStageOverviewStatus = awarded
        ? "awarded"
        : totalRequirements > 0 && completedRequirements === totalRequirements
          ? "requirements-complete"
          : completedRequirements > 0
            ? "in-progress"
            : "not-started";
      return { stage: stage.stage, completedRequirements, totalRequirements, status };
    });
    const highestAwardedStage = stages.filter((stage) => stage.status === "awarded").at(-1)?.stage ?? 0;
    const activeStage = stages.find((stage) => stage.status !== "awarded") ?? stages.at(-1)!;
    const status = stages.some((stage) => stage.status === "requirements-complete")
      ? "requirements-complete"
      : activeStage.status;
    return {
      skillId: skill.id,
      skillName: skill.name,
      stages,
      nextStage: activeStage.stage,
      highestAwardedStage,
      status
    };
  });
}

