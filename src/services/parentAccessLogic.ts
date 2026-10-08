export const PARENT_ACCESS_STATUSES = ["pending", "approved", "rejected", "revoked"] as const;
export type ParentAccessStatus = (typeof PARENT_ACCESS_STATUSES)[number];

type ParentAccessSortRecord = {
  uid: string;
  displayName: string;
  email: string;
  status: ParentAccessStatus;
};

const parentAccessStatusOrder: Record<ParentAccessStatus, number> = {
  pending: 0,
  approved: 1,
  rejected: 2,
  revoked: 2
};

function compareStableText(left: string, right: string): number {
  const normalizedLeft = left.trim().normalize("NFKC").toLowerCase();
  const normalizedRight = right.trim().normalize("NFKC").toLowerCase();
  if (normalizedLeft !== normalizedRight) return normalizedLeft < normalizedRight ? -1 : 1;
  const trimmedLeft = left.trim();
  const trimmedRight = right.trim();
  return trimmedLeft === trimmedRight ? 0 : trimmedLeft < trimmedRight ? -1 : 1;
}

export function sortParentAccessRecords<T extends ParentAccessSortRecord>(records: readonly T[]): T[] {
  return [...records].sort((left, right) =>
    parentAccessStatusOrder[left.status] - parentAccessStatusOrder[right.status]
    || compareStableText(left.displayName || left.email, right.displayName || right.email)
    || compareStableText(left.email, right.email)
    || compareStableText(left.uid, right.uid)
  );
}

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
