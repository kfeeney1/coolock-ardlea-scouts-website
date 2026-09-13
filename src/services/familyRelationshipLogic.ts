export type FamilyMemberLike = {
  id: string;
  familyId?: string;
};

export type FamilyAssignment = {
  memberId: string;
  familyId: string;
};

export function familyMembers<T extends FamilyMemberLike>(members: readonly T[], member: FamilyMemberLike): T[] {
  if (!member.familyId) return [members.find((item) => item.id === member.id)].filter((item): item is T => Boolean(item));
  return members.filter((item) => item.familyId === member.familyId);
}

export function planFamilyLink(
  members: readonly FamilyMemberLike[],
  memberId: string,
  siblingId: string,
  newFamilyId: string
): FamilyAssignment[] {
  if (!memberId || !siblingId || memberId === siblingId) throw new Error("Choose a different member to link as a sibling.");
  const member = members.find((item) => item.id === memberId);
  const sibling = members.find((item) => item.id === siblingId);
  if (!member || !sibling) throw new Error("Both members must be available in Member Management.");

  if (member.familyId && member.familyId === sibling.familyId) return [];

  const targetFamilyId = member.familyId || sibling.familyId || newFamilyId;
  if (!targetFamilyId) throw new Error("Unable to create a family identifier.");

  const familyIdsToMerge = new Set([member.familyId, sibling.familyId].filter(Boolean));
  const affectedIds = new Set([member.id, sibling.id]);
  for (const candidate of members) {
    if (candidate.familyId && familyIdsToMerge.has(candidate.familyId)) affectedIds.add(candidate.id);
  }

  return [...affectedIds]
    .map((id) => ({ memberId: id, familyId: targetFamilyId }))
    .sort((a, b) => a.memberId.localeCompare(b.memberId));
}

export function planFamilyUnlink(members: readonly FamilyMemberLike[], memberId: string): FamilyAssignment[] {
  const member = members.find((item) => item.id === memberId);
  if (!member?.familyId) return [];

  const remaining = members.filter((item) => item.id !== memberId && item.familyId === member.familyId);
  const assignments: FamilyAssignment[] = [{ memberId, familyId: "" }];
  if (remaining.length === 1) assignments.push({ memberId: remaining[0].id, familyId: "" });
  return assignments.sort((a, b) => a.memberId.localeCompare(b.memberId));
}

export function familySearchResults<T extends FamilyMemberLike & { displayName: string; section: string }>(
  members: readonly T[],
  current: FamilyMemberLike,
  query: string
): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return members
    .filter((candidate) => candidate.id !== current.id)
    .filter((candidate) => !current.familyId || candidate.familyId !== current.familyId)
    .filter((candidate) => `${candidate.displayName} ${candidate.section}`.toLowerCase().includes(normalized))
    .slice(0, 30);
}
