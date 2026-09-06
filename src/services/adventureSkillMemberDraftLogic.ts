import { isStageRequirementComplete } from "./adventureSkillProgressLogic.ts";
import type { MemberAdventureProgress } from "./adventureSkillProgress.ts";

const SEPARATOR = "::";

export function memberRequirementDraftKey(memberId: string, requirementId: string): string {
  return `${memberId}${SEPARATOR}${requirementId}`;
}

export function parseMemberRequirementDraftKey(key: string): { memberId: string; requirementId: string } {
  const separatorIndex = key.indexOf(SEPARATOR);
  if (separatorIndex < 1 || separatorIndex === key.length - SEPARATOR.length) throw new Error("Invalid member requirement draft key.");
  return { memberId: key.slice(0, separatorIndex), requirementId: key.slice(separatorIndex + SEPARATOR.length) };
}

export function memberRequirementCompletion(
  memberId: string,
  requirementId: string,
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>,
  groupDraft: ReadonlyMap<string, boolean>,
  memberDraft: ReadonlyMap<string, boolean>
): boolean {
  const memberOverride = memberDraft.get(memberRequirementDraftKey(memberId, requirementId));
  if (memberOverride !== undefined) return memberOverride;
  const groupOverride = groupDraft.get(requirementId);
  if (groupOverride !== undefined) return groupOverride;
  const progress = progressByMemberId.get(memberId);
  return isStageRequirementComplete(new Set(progress?.requirements.map((item) => item.requirementId) ?? []), requirementId);
}

export function clearMemberDraftForRequirement(memberDraft: ReadonlyMap<string, boolean>, requirementId: string): Map<string, boolean> {
  return new Map([...memberDraft].filter(([key]) => parseMemberRequirementDraftKey(key).requirementId !== requirementId));
}
