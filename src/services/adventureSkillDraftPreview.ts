import type { MemberAdventureProgress } from "./adventureSkillProgress.ts";
import { completionTargetsForRequirement } from "./adventureSkillProgressLogic.ts";
import { memberRequirementDraftChanges } from "./adventureSkillMemberDraftLogic.ts";

/** Ephemeral projection only. Apply group changes, then individual exceptions, like Save. */
export function adventureSkillDraftPreview(
  memberId: string,
  saved: MemberAdventureProgress | undefined,
  groupDraft: ReadonlyMap<string, boolean>,
  memberDraft: ReadonlyMap<string, boolean>
): MemberAdventureProgress {
  const requirements = new Map((saved?.requirements ?? []).map(record => [record.requirementId, record]));
  const apply = (requirementId: string, completed: boolean) => {
    for (const target of completionTargetsForRequirement(requirementId)) {
      if (!completed) requirements.delete(target.requirementId);
      else if (!requirements.has(target.requirementId)) requirements.set(target.requirementId, {
        ...target, completedAt: null, completedBy: "", sourceType: "manual", sourceId: ""
      });
    }
  };
  for (const [id, completed] of groupDraft) apply(id, completed);
  for (const change of memberRequirementDraftChanges(memberDraft)) {
    if (change.memberId === memberId) apply(change.requirementId, change.completed);
  }
  return { memberId, requirements: [...requirements.values()], awards: saved?.awards ?? [] };
}
