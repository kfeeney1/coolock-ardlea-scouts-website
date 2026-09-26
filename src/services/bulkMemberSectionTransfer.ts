import { collection, doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";

import { auth, db } from "../firebase";
import type { MemberRecord, MemberStatus } from "./memberAdmin";
import { normalizeLeaderSections } from "./leaderAccessLogic";
import { recordAuditEvent } from "./auditLog";
import { isGroupLeadershipAppointment } from "../security/scoutingAppointments";

export const YOUTH_MEMBER_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"] as const;
export type YouthMemberSection = typeof YOUTH_MEMBER_SECTIONS[number];

export type BulkSectionTransferMember = Pick<MemberRecord, "id" | "displayName" | "section" | "status" | "updatedAt">;

export type BulkSectionTransferResult = {
  operationId: string;
  memberIds: string[];
  destinationSection: YouthMemberSection;
};

const MAX_BULK_TRANSFER_MEMBERS = 200;

function isYouthSection(value: string): value is YouthMemberSection {
  return (YOUTH_MEMBER_SECTIONS as readonly string[]).includes(value);
}

function status(value: unknown): MemberStatus | null {
  return value === "active" || value === "inactive" || value === "left" ? value : null;
}

function timestampMillis(value: unknown): number | null {
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis: () => number }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

async function loadTransferScope(): Promise<{ allSections: boolean; sections: string[] }> {
  const user = auth.currentUser;
  if (!user) throw new Error("No signed-in leader.");
  const [profileSnapshot, organisationSnapshot] = await Promise.all([
    getDoc(doc(db, "adminUsers", user.uid)),
    getDoc(doc(db, "organisationLeadership", user.uid))
  ]);
  if (!profileSnapshot.exists() || profileSnapshot.data().active !== true) throw new Error("Active leader profile is required.");
  const profile = profileSnapshot.data();
  const organisation = organisationSnapshot.exists() ? organisationSnapshot.data() : null;
  const allSections = profile.role === "admin" || profile.role === "super-admin"
    || (organisation?.active === true && isGroupLeadershipAppointment(organisation.scoutingRole));
  return { allSections, sections: normalizeLeaderSections(profile) };
}

export async function loadBulkTransferDestinations(): Promise<YouthMemberSection[]> {
  const scope = await loadTransferScope();
  return YOUTH_MEMBER_SECTIONS.filter((section) => scope.allSections || scope.sections.includes(section));
}

export async function bulkTransferMembersSection(
  selectedMembers: BulkSectionTransferMember[],
  destinationSection: string
): Promise<BulkSectionTransferResult> {
  const user = auth.currentUser;
  if (!user) throw new Error("No signed-in leader.");
  if (!isYouthSection(destinationSection)) throw new Error("Select a valid youth section.");
  if (selectedMembers.length === 0) throw new Error("Select at least one member.");
  if (selectedMembers.length > MAX_BULK_TRANSFER_MEMBERS) throw new Error(`A maximum of ${MAX_BULK_TRANSFER_MEMBERS} members can be moved in one operation.`);
  if (new Set(selectedMembers.map((member) => member.id)).size !== selectedMembers.length) throw new Error("Duplicate members were selected.");
  if (selectedMembers.some((member) => member.status !== "active")) throw new Error("Only active members can be moved in bulk.");
  if (selectedMembers.every((member) => member.section === destinationSection)) throw new Error("All selected members are already in that section.");

  const scope = await loadTransferScope();
  if (!scope.allSections && !scope.sections.includes(destinationSection)) throw new Error("You are not authorised to move members to that section.");

  const operationId = `bulk-section-transfer-${crypto.randomUUID()}`;
  const memberRefs = selectedMembers.map((member) => doc(db, "members", member.id));

  await runTransaction(db, async (transaction) => {
    const snapshots = await Promise.all(memberRefs.map((ref) => transaction.get(ref)));
    const validated = snapshots.map((snapshot, index) => {
      const expected = selectedMembers[index];
      if (!snapshot.exists()) throw new Error(`${expected.displayName} is no longer available. Refresh and try again.`);
      const data = snapshot.data();
      const currentSection = typeof data.section === "string" ? data.section : "";
      const currentStatus = status(data.status);
      if (!currentSection || !currentStatus) throw new Error("A selected member no longer matches the member schema. Refresh and try again.");
      if (currentStatus !== "active") throw new Error(`${expected.displayName} is no longer an active member. Refresh and review the selection.`);
      if (currentSection !== expected.section) throw new Error(`${expected.displayName}'s section changed after selection. Refresh and review the selection.`);
      const expectedUpdated = expected.updatedAt?.getTime() ?? null;
      const actualUpdated = timestampMillis(data.updatedAt);
      if (expectedUpdated !== null && actualUpdated !== null && expectedUpdated !== actualUpdated) {
        throw new Error(`${expected.displayName} changed after selection. Refresh and review the selection.`);
      }
      if (!scope.allSections && !scope.sections.includes(currentSection)) throw new Error("Your access to a selected member changed. Refresh and try again.");
      return { expected, currentSection, currentStatus };
    });

    for (const [index, item] of validated.entries()) {
      if (item.currentSection === destinationSection) continue;
      transaction.update(memberRefs[index], {
        section: destinationSection,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      });
      const historyRef = doc(collection(db, "memberHistory"));
      transaction.set(historyRef, {
        memberId: item.expected.id,
        memberName: item.expected.displayName.trim().slice(0, 200),
        changeType: "section-transfer",
        fromSection: item.currentSection,
        toSection: destinationSection,
        fromStatus: item.currentStatus,
        toStatus: item.currentStatus,
        changedBy: user.uid,
        changedAt: serverTimestamp()
      });
    }
  });

  await recordAuditEvent({
    category: "member",
    action: "Bulk section transfer",
    targetId: operationId,
    targetLabel: `${selectedMembers.length} members`,
    section: destinationSection,
    description: `Member Management bulk transfer to ${destinationSection}: ${selectedMembers.map((member) => member.id).join(", ")}.`
  });

  return { operationId, memberIds: selectedMembers.map((member) => member.id), destinationSection };
}
