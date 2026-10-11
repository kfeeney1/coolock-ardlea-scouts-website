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
