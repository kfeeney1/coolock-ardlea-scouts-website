import type { MemberAdventureProgress } from "./adventureSkillProgress.ts";
import { isStageRequirementComplete } from "./adventureSkillProgressLogic.ts";

export type SelectionState = "none" | "some" | "all";

export function requirementSelectionState(
  selectedMemberIds: readonly string[],
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>,
  requirementId: string
): SelectionState {
  if (selectedMemberIds.length === 0) return "none";
  let completed = 0;
  for (const memberId of selectedMemberIds) {
    const progress = progressByMemberId.get(memberId);
    const completedIds = new Set(progress?.requirements.map((item) => item.requirementId) ?? []);
    if (isStageRequirementComplete(completedIds, requirementId)) completed += 1;
  }
  if (completed === 0) return "none";
  return completed === selectedMemberIds.length ? "all" : "some";
}

export function selectedMemberSummary(selectedMemberIds: readonly string[], totalVisibleMembers: number): string {
  if (selectedMemberIds.length === 0) return "No children selected";
  if (selectedMemberIds.length === 1) return "1 child selected";
  if (selectedMemberIds.length === totalVisibleMembers && totalVisibleMembers > 0) return `All ${totalVisibleMembers} children selected`;
  return `${selectedMemberIds.length} children selected`;
}
