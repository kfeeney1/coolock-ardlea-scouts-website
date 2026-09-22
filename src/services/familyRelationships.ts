import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";

import { auth, db } from "../firebase";
import { recordAuditEvent } from "./auditLog";
import type { MemberRecord } from "./memberAdmin";
import { planFamilyLink, planFamilyUnlink } from "./familyRelationshipLogic";

async function requireAdmin(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("No signed-in leader.");
  const profile = await getDoc(doc(db, "adminUsers", user.uid));
  if (!profile.exists() || profile.data().active !== true || !["admin", "super-admin"].includes(profile.data().role)) {
    throw new Error("Administrator access is required to manage family relationships.");
  }
}

function nextFamilyId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `family-${crypto.randomUUID()}`;
  return `family-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function applyAssignments(members: readonly MemberRecord[], assignments: Array<{ memberId: string; familyId: string }>): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("No signed-in leader.");
  if (!assignments.length) return;

  const expectedFamilyById = new Map(members.map((member) => [member.id, member.familyId || ""]));
  await runTransaction(db, async (transaction) => {
    const snapshots = await Promise.all(assignments.map(({ memberId }) => transaction.get(doc(db, "members", memberId))));
    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) throw new Error("A member record changed or was removed. Refresh and try again.");
      const actualFamilyId = typeof snapshot.data().familyId === "string" ? snapshot.data().familyId : "";
      if (actualFamilyId !== (expectedFamilyById.get(assignments[index].memberId) || "")) {
        throw new Error("A family relationship changed while you were editing. Refresh and review the family before trying again.");
      }
    });
    assignments.forEach(({ memberId, familyId }) => transaction.update(doc(db, "members", memberId), {
      familyId,
      familyUpdatedBy: user.uid,
      familyUpdatedAt: serverTimestamp()
    }));
  });
}

export async function linkSiblings(members: readonly MemberRecord[], memberId: string, siblingIds: readonly string[]): Promise<void> {
  await requireAdmin();
  const uniqueSiblingIds = [...new Set(siblingIds.filter((id) => id && id !== memberId))];
  if (!uniqueSiblingIds.length) throw new Error("Choose at least one different member to link as a sibling.");
  let plannedMembers = members.map((member) => ({ ...member }));
  const assignmentsById = new Map<string, string>();
  for (const siblingId of uniqueSiblingIds) {
    const assignments = planFamilyLink(plannedMembers, memberId, siblingId, nextFamilyId());
    assignments.forEach(({ memberId: id, familyId }) => {
      assignmentsById.set(id, familyId);
      plannedMembers = plannedMembers.map((member) => member.id === id ? { ...member, familyId } : member);
    });
  }
  const assignments = [...assignmentsById].map(([memberId, familyId]) => ({ memberId, familyId }));
  if (!assignments.length) return;
  await applyAssignments(members, assignments);
  const member = members.find((item) => item.id === memberId);
  await recordAuditEvent({ category: "member", action: "Family relationships linked", targetId: memberId, targetLabel: member?.displayName || memberId, section: member?.section || "", description: `Linked ${uniqueSiblingIds.length} sibling${uniqueSiblingIds.length === 1 ? "" : "s"} in one atomic family update.` });
}

export async function linkSibling(members: readonly MemberRecord[], memberId: string, siblingId: string): Promise<void> {
  return linkSiblings(members, memberId, [siblingId]);
}

export async function unlinkFromFamily(members: readonly MemberRecord[], memberId: string): Promise<void> {
  await requireAdmin();
  const assignments = planFamilyUnlink(members, memberId);
  if (!assignments.length) return;
  await applyAssignments(members, assignments);

  const member = members.find((item) => item.id === memberId);
  await recordAuditEvent({
    category: "member",
    action: "Family relationship unlinked",
    targetId: memberId,
    targetLabel: member?.displayName || memberId,
    section: member?.section || "",
    description: `Removed the member from the canonical family relationship. ${assignments.length} member record${assignments.length === 1 ? "" : "s"} were updated atomically.`
  });
}
