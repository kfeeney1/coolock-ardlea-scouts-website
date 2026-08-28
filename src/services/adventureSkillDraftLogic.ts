import type { SelectionState } from "./adventureSkillSelectionLogic.ts";

export type AdventureRequirementDraft = ReadonlyMap<string, boolean>;

export function draftSelectionState(
  draft: AdventureRequirementDraft,
  requirementId: string,
  persistedState: SelectionState
): SelectionState {
  if (!draft.has(requirementId)) return persistedState;
  return draft.get(requirementId) ? "all" : "none";
}

export function setDraftRequirement(
  current: AdventureRequirementDraft,
  requirementId: string,
  completed: boolean
): Map<string, boolean> {
  const next = new Map(current);
  next.set(requirementId, completed);
  return next;
}

export function completeStageDraft(
  current: AdventureRequirementDraft,
  requirementIds: readonly string[]
): Map<string, boolean> {
  const next = new Map(current);
  for (const requirementId of requirementIds) next.set(requirementId, true);
  return next;
}
