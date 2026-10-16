import { adventureSkillsById } from "../data/adventureSkills/index.ts";
import { isStageRequirementComplete } from "./adventureSkillProgressLogic.ts";
import { adventureSkillOverview, type AdventureSkillOverview } from "./adventureSkillOverviewLogic.ts";
import type { MemberAdventureProgress } from "./adventureSkillProgress.ts";

export type ParentAdventureRequirementSummary = {
  requirementId: string;
  statement: string;
  completed: boolean;
};

export type ParentAdventureStageSummary = AdventureSkillOverview["stages"][number] & {
  requirements: ParentAdventureRequirementSummary[];
};

export type ParentAdventureSkillSummary = Omit<AdventureSkillOverview, "stages"> & {
  completedRequirements: number;
  totalRequirements: number;
  completedStages: number;
  awardedStages: number;
  stageCount: number;
  stages: ParentAdventureStageSummary[];
};

/** Adds read-only competency detail to the same progress summaries used by leaders. */
export function parentAdventureSkillSummaries(progress: MemberAdventureProgress): ParentAdventureSkillSummary[] {
  const completedIds = new Set(progress.requirements.map((requirement) => requirement.requirementId));

  return adventureSkillOverview(progress).map((skill) => {
    const definition = adventureSkillsById.get(skill.skillId);
    const stages = skill.stages.map((stage) => ({
      ...stage,
      requirements: (definition?.stages.find((item) => item.stage === stage.stage)?.requirements ?? []).map((requirement) => ({
        requirementId: requirement.id,
        statement: requirement.statement,
        completed: isStageRequirementComplete(completedIds, requirement.id)
      }))
    }));

    return {
      ...skill,
      completedRequirements: stages.reduce((total, stage) => total + stage.completedRequirements, 0),
      totalRequirements: stages.reduce((total, stage) => total + stage.totalRequirements, 0),
      completedStages: stages.filter((stage) => stage.status === "requirements-complete" || stage.status === "awarded").length,
      awardedStages: stages.filter((stage) => stage.status === "awarded").length,
      stageCount: stages.length,
      stages
    };
  });
}
