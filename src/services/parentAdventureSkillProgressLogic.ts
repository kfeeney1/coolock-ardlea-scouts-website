import { adventureSkills } from "../data/adventureSkills/index.ts";
import { isStageRequirementComplete } from "./adventureSkillProgressLogic.ts";
import type { MemberAdventureProgress } from "./adventureSkillProgress.ts";

export type ParentAdventureRequirementSummary = {
  requirementId: string;
  statement: string;
  completed: boolean;
};

export type ParentAdventureStageSummary = {
  stage: number;
  completedRequirements: number;
  totalRequirements: number;
  requirementsComplete: boolean;
  awarded: boolean;
  requirements: ParentAdventureRequirementSummary[];
};

export type ParentAdventureSkillSummary = {
  skillId: string;
  skillName: string;
  completedRequirements: number;
  totalRequirements: number;
  completedStages: number;
  awardedStages: number;
  stageCount: number;
  stages: ParentAdventureStageSummary[];
};

export function parentAdventureSkillSummaries(progress: MemberAdventureProgress): ParentAdventureSkillSummary[] {
  const completedIds = new Set(progress.requirements.map((requirement) => requirement.requirementId));
  const awarded = new Set(progress.awards.map((award) => `${award.skillId}-stage-${award.stage}`));

  return adventureSkills.map((skill) => {
    const stages = skill.stages.map((stage) => {
      const requirements = stage.requirements.map((requirement) => ({
        requirementId: requirement.id,
        statement: requirement.statement,
        completed: isStageRequirementComplete(completedIds, requirement.id)
      }));
      const completedRequirements = requirements.filter((requirement) => requirement.completed).length;
      const totalRequirements = requirements.length;
      return {
        stage: stage.stage,
        completedRequirements,
        totalRequirements,
        requirementsComplete: totalRequirements > 0 && completedRequirements === totalRequirements,
        awarded: awarded.has(`${skill.id}-stage-${stage.stage}`),
        requirements
      };
    });

    return {
      skillId: skill.id,
      skillName: skill.name,
      completedRequirements: stages.reduce((total, stage) => total + stage.completedRequirements, 0),
      totalRequirements: stages.reduce((total, stage) => total + stage.totalRequirements, 0),
      completedStages: stages.filter((stage) => stage.requirementsComplete).length,
      awardedStages: stages.filter((stage) => stage.awarded).length,
      stageCount: stages.length,
      stages
    };
  });
}
