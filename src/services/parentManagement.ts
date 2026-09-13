import { recordAuditEvent } from "./auditLog";
import { updateParentAccess } from "./parentPortal";
import type { ParentAccount } from "./parentPortal";

export async function disableParentPortalAccess(parent: ParentAccount, reason: string): Promise<void> {
  if (parent.status !== "approved") return;
  await updateParentAccess(parent.uid, "revoked", parent.memberIds, parent.linkedSections);
  await recordAuditEvent({
    category: "parent-access",
    action: "Parent access disabled",
    targetId: parent.uid,
    targetLabel: parent.displayName || parent.email,
    section: parent.linkedSections.join(", "),
    description: `${reason} Parent-child links were retained and Leader access was not changed.`
  });
}
