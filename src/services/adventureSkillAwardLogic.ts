import { completionTargetsForRequirement, isStageComplete } from "./adventureSkillProgressLogic.ts";
import type { AdventureRequirementProgressRecord, MemberAdventureProgress } from "./adventureSkillProgress.ts";
import type { SelectionState } from "./adventureSkillSelectionLogic.ts";

export function stageAwardSelectionState(
  selectedMemberIds: readonly string[],
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>,
  skillId: string,
  stage: number
): SelectionState {
  if (selectedMemberIds.length === 0) return "none";
  const awarded = selectedMemberIds.filter((memberId) =>
    progressByMemberId.get(memberId)?.awards.some((award) => award.skillId === skillId && award.stage === stage)
  ).length;
  if (awarded === 0) return "none";
  return awarded === selectedMemberIds.length ? "all" : "some";
}

export function membersWithIncompleteStage(
  selectedMemberIds: readonly string[],
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>,
  skillId: string,
  stage: number
): string[] {
  return selectedMemberIds.filter((memberId) => {
    const progress = progressByMemberId.get(memberId);
    if (!progress) return true;
    return !isStageComplete(new Set(progress.requirements.map((item) => item.requirementId)), skillId, stage);
  });
}

export function requirementProvenance(
  progress: MemberAdventureProgress | undefined,
  requirementId: string
): AdventureRequirementProgressRecord | null {
  if (!progress) return null;
  const equivalentIds = new Set(completionTargetsForRequirement(requirementId).map((target) => target.requirementId));
  const records = progress.requirements.filter((record) => equivalentIds.has(record.requirementId));
  if (records.length === 0) return null;
  return [...records].sort((left, right) => (right.completedAt?.getTime() ?? 0) - (left.completedAt?.getTime() ?? 0))[0] ?? null;
}
