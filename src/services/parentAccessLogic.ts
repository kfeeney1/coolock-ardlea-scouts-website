export const PARENT_ACCESS_STATUSES = ["pending", "approved", "rejected", "revoked"] as const;
export type ParentAccessStatus = (typeof PARENT_ACCESS_STATUSES)[number];

export function isParentAccessStatus(value: unknown): value is ParentAccessStatus {
  return typeof value === "string" && PARENT_ACCESS_STATUSES.includes(value as ParentAccessStatus);
}

export function parentAccessLinks(
  status: ParentAccessStatus,
  memberIds: readonly string[],
  linkedSections: readonly string[]
): { memberIds: string[]; linkedSections: string[] } {
  if (status !== "approved") return { memberIds: [], linkedSections: [] };

  return {
    memberIds: [...new Set(memberIds.map((id) => id.trim()).filter(Boolean))],
    linkedSections: [...new Set(linkedSections.map((section) => section.trim()).filter(Boolean))]
  };
}
