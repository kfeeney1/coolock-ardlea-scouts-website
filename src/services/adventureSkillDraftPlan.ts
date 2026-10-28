import { completionTargetsForRequirement } from "./adventureSkillProgressLogic.ts";
import { memberRequirementDraftChanges } from "./adventureSkillMemberDraftLogic.ts";

/** One final operation per canonical document; individual exceptions win. */
export function adventureSkillDraftPlan(memberIds: readonly string[], groupDraft: ReadonlyMap<string, boolean>, memberDraft: ReadonlyMap<string, boolean>) {
  const selected = new Set(memberIds.map(id => id.trim()).filter(Boolean));
  const operations = new Map<string, { memberId: string; target: ReturnType<typeof completionTargetsForRequirement>[number]; completed: boolean }>();
  const apply = (memberId: string, id: string, completed: boolean) => {
    for (const target of completionTargetsForRequirement(id)) operations.set(`${memberId}/${target.requirementId}`, { memberId, target, completed });
  };
  for (const [id, completed] of groupDraft) for (const memberId of selected) apply(memberId, id, completed);
  for (const change of memberRequirementDraftChanges(memberDraft)) {
    if (!selected.has(change.memberId)) throw new Error("Draft contains a child outside the current selection.");
    apply(change.memberId, change.requirementId, change.completed);
  }
  return [...operations.values()];
}
