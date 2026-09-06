import { isStageRequirementComplete } from "./adventureSkillProgressLogic.ts";
import type { MemberAdventureProgress } from "./adventureSkillProgress.ts";

export function memberRequirementCompletion(progress: MemberAdventureProgress | undefined, requirementId: string): boolean {
  const completedIds = new Set(progress?.requirements.map((item) => item.requirementId) ?? []);
  return isStageRequirementComplete(completedIds, requirementId);
}
