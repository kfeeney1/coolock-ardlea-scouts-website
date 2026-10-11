export type RoverAdultIdentity = { displayName: string; email: string };

/** Permit a member record to link to an adult account only on an exact name/email match. */
export function matchesRoverAdultIdentity(
  member: { displayName?: unknown; emailAddress?: unknown },
  adult: RoverAdultIdentity
): boolean {
  const memberName = typeof member.displayName === "string" ? member.displayName.trim() : "";
  const memberEmail = typeof member.emailAddress === "string" ? member.emailAddress.trim() : "";
  return Boolean(memberName && memberEmail)
    && memberName === adult.displayName.trim()
    && memberEmail === adult.email.trim();
}

export function roverMembershipSections(sections: readonly string[], enabled: boolean): string[] {
  const otherSections = [...new Set(sections.filter((section) => section !== "Rovers"))];
  return enabled ? [...otherSections, "Rovers"] : otherSections;
}

export function matchingUnlinkedRoverMembers<T extends { id: string; accountUid?: unknown; displayName?: unknown; emailAddress?: unknown }>(
  records: T[],
  adult: RoverAdultIdentity
): T[] {
  return records.filter((record) => {
    const accountUid = typeof record.accountUid === "string" ? record.accountUid.trim() : "";
    return !accountUid && matchesRoverAdultIdentity(record, adult);
  });
}
