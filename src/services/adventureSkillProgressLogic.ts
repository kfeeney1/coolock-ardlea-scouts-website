import {
  adventureSkillsById,
  allAdventureSkillRequirements,
  requirementsForSharedCompetency,
  type AdventureSkillRequirement
} from "../data/adventureSkills/index.ts";

export type AdventureProgressSourceType = "manual" | "weeklyMeeting" | "event" | "activity" | "migration";

export type AdventureRequirementCompletion = {
  requirementId: string;
  skillId: string;
  stage: number;
  sharedCompetencyKey: string;
};

export type AdventureStageAward = {
  skillId: string;
  stage: number;
};

function requirementLocation(requirementId: string): { requirement: AdventureSkillRequirement; skillId: string; stage: number } | null {
  for (const skill of adventureSkillsById.values()) {
    for (const stage of skill.stages) {
      const requirement = stage.requirements.find((item) => item.id === requirementId);
      if (requirement) return { requirement, skillId: skill.id, stage: stage.stage };
    }
  }
  return null;
}

export function completionTargetsForRequirement(requirementId: string): AdventureRequirementCompletion[] {
  const location = requirementLocation(requirementId);
  if (!location) throw new Error(`Unknown Adventure Skills requirement: ${requirementId}`);

  const sharedKey = location.requirement.sharedCompetencyKey;
  const requirements = sharedKey ? requirementsForSharedCompetency(sharedKey) : [location.requirement];
  return requirements.map((requirement) => {
    const target = requirementLocation(requirement.id);
    if (!target) throw new Error(`Adventure Skills catalogue location missing for ${requirement.id}`);
    return {
      requirementId: requirement.id,
      skillId: target.skillId,
      stage: target.stage,
      sharedCompetencyKey: requirement.sharedCompetencyKey ?? ""
    };
  });
}

export function requirementIdsForStage(skillId: string, stageNumber: number): string[] {
  const skill = adventureSkillsById.get(skillId);
  if (!skill) throw new Error(`Unknown Adventure Skill: ${skillId}`);
  const stage = skill.stages.find((item) => item.stage === stageNumber);
  if (!stage) throw new Error(`Unknown ${skill.name} stage: ${stageNumber}`);
  return stage.requirements.map((requirement) => requirement.id);
}

export function completionTargetsForStage(skillId: string, stageNumber: number): AdventureRequirementCompletion[] {
  const unique = new Map<string, AdventureRequirementCompletion>();
  for (const requirementId of requirementIdsForStage(skillId, stageNumber)) {
    for (const target of completionTargetsForRequirement(requirementId)) unique.set(target.requirementId, target);
  }
  return [...unique.values()];
}

export function isStageRequirementComplete(completedRequirementIds: ReadonlySet<string>, requirementId: string): boolean {
  return completionTargetsForRequirement(requirementId).some((target) => completedRequirementIds.has(target.requirementId));
}

export function isStageComplete(completedRequirementIds: ReadonlySet<string>, skillId: string, stageNumber: number): boolean {
  return requirementIdsForStage(skillId, stageNumber)
    .every((requirementId) => isStageRequirementComplete(completedRequirementIds, requirementId));
}

export function stageAwardId(skillId: string, stageNumber: number): string {
  const skill = adventureSkillsById.get(skillId);
  if (!skill || !skill.stages.some((stage) => stage.stage === stageNumber)) {
    throw new Error(`Unknown Adventure Skills award: ${skillId} stage ${stageNumber}`);
  }
  return `${skillId}-stage-${stageNumber}`;
}

export function allKnownRequirementIds(): Set<string> {
  return new Set(allAdventureSkillRequirements().map((requirement) => requirement.id));
}
