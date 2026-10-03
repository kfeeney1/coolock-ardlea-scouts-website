export const YOUTH_ROLES_BY_SECTION: Readonly<Record<string, readonly string[]>> = {
  Beavers: ["Lodge Leader", "Assistant Lodge Leader"],
  Cubs: ["Sixer", "Seconder"],
  Scouts: ["Patrol Leader", "Assistant Patrol Leader"],
  Ventures: ["Executive Committee"],
  Rovers: ["Crew Leader"]
};

export type MemberSectionRoles = Record<string, string>;

export function normalizeMemberSectionRoles(value: unknown, sections: readonly string[]): MemberSectionRoles {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowedSections = new Set(sections);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([section, role]) =>
    allowedSections.has(section) && typeof role === "string" && YOUTH_ROLES_BY_SECTION[section]?.includes(role)
      ? [[section, role]]
      : []
  ));
}

export function setMemberSectionRole(
  roles: MemberSectionRoles | undefined,
  section: string,
  role: string,
  sections: readonly string[]
): MemberSectionRoles {
  const next = normalizeMemberSectionRoles(roles, sections);
  if (!role) delete next[section];
  else if (YOUTH_ROLES_BY_SECTION[section]?.includes(role)) next[section] = role;
  return next;
}

export function filterMembersBySectionRole<T extends { section: string; sections?: string[]; sectionRoles?: MemberSectionRoles }>(
  members: readonly T[], section: string, role: string
): T[] {
  if (!role || section === "all") return [...members];
  return members.filter((member) => (member.sectionRoles?.[section] || "") === role);
}
