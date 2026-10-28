import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ServiceFailure, UserFacingError } from "./applicationErrors.ts";
import { adventureSkillDraftPlan } from "./adventureSkillDraftPlan.ts";
import type { AdventureProgressSource } from "./adventureSkillProgress.ts";

/** A redesigned Save is one atomic commit; never split a draft into partial saves. */
export async function saveAdventureSkillDraft(memberIds: readonly string[], groupDraft: ReadonlyMap<string, boolean>, memberDraft: ReadonlyMap<string, boolean>, source: AdventureProgressSource) {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");
  const operations = adventureSkillDraftPlan(memberIds, groupDraft, memberDraft);
  if (!operations.length) throw new UserFacingError("Select at least one child and competency change.");
  // One commit preserves all-or-nothing permission checks, including large groups.
  const batch = writeBatch(db);
  for (const { memberId, target, completed } of operations) {
    const ref = doc(collection(db, "memberAdventureSkillProgress", memberId, "requirements"), target.requirementId);
    if (!completed) batch.delete(ref);
    else batch.set(ref, { ...target, memberId, completedAt: serverTimestamp(), completedBy: userId, sourceType: source.type, sourceId: source.id?.trim() ?? "" });
  }
  await batch.commit();
}
