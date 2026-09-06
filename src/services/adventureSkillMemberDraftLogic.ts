import { isStageRequirementComplete } from "./adventureSkillProgressLogic.ts";
import type { MemberAdventureProgress } from "./adventureSkillProgress.ts";

const memberDraftSeparator = "::";

export type MemberRequirementDraftChange = {
  memberId: string;
  requirementId: string;
  completed: boolean;
};

export function memberRequirementCompletion(progress: MemberAdventureProgress | undefined, requirementId: string): boolean {
  const completedIds = new Set(progress?.requirements.map((item) => item.requirementId) ?? []);
  return isStageRequirementComplete(completedIds, requirementId);
}

export function memberRequirementDraftKey(memberId: string, requirementId: string): string {
  return `${memberId}${memberDraftSeparator}${requirementId}`;
}

export function memberRequirementDraftCompletion(
  draft: ReadonlyMap<string, boolean>,
  memberId: string,
  requirementId: string,
  baseline: boolean
): boolean {
  return draft.get(memberRequirementDraftKey(memberId, requirementId)) ?? baseline;
}

export function setMemberRequirementDraft(
  current: ReadonlyMap<string, boolean>,
  memberId: string,
  requirementId: string,
  completed: boolean,
  baseline: boolean
): Map<string, boolean> {
  const next = new Map(current);
  const key = memberRequirementDraftKey(memberId, requirementId);
  if (completed === baseline) next.delete(key);
  else next.set(key, completed);
  return next;
}

export function clearMemberRequirementDraftForRequirement(
  current: ReadonlyMap<string, boolean>,
  requirementId: string
): Map<string, boolean> {
  const next = new Map(current);
  const suffix = `${memberDraftSeparator}${requirementId}`;
  for (const key of next.keys()) {
    if (key.endsWith(suffix)) next.delete(key);
  }
  return next;
}

export function memberRequirementDraftChanges(draft: ReadonlyMap<string, boolean>): MemberRequirementDraftChange[] {
  return [...draft.entries()].flatMap(([key, completed]) => {
    const separatorIndex = key.indexOf(memberDraftSeparator);
    if (separatorIndex <= 0) return [];
    const memberId = key.slice(0, separatorIndex);
    const requirementId = key.slice(separatorIndex + memberDraftSeparator.length);
    return memberId && requirementId ? [{ memberId, requirementId, completed }] : [];
  });
}
