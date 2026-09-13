import type { MemberRecord } from "./memberAdmin";
import type { ParentAccount } from "./parentPortal";

export type ParentLifecycleCandidate = {
  parent: ParentAccount;
  otherActiveChildren: MemberRecord[];
};

export function parentLifecycleCandidates(
  parents: readonly ParentAccount[],
  members: readonly MemberRecord[],
  memberId: string,
  nextMemberStatus: MemberRecord["status"]
): ParentLifecycleCandidate[] {
  if (nextMemberStatus === "active") return [];
  const memberById = new Map(members.map((member) => [member.id, member]));
  return parents
    .filter((parent) => parent.status === "approved" && parent.memberIds.includes(memberId))
    .map((parent) => ({
      parent,
      otherActiveChildren: parent.memberIds
        .filter((id) => id !== memberId)
        .map((id) => memberById.get(id))
        .filter((member): member is MemberRecord => Boolean(member && member.status === "active"))
    }))
    .filter((candidate) => candidate.otherActiveChildren.length === 0);
}
