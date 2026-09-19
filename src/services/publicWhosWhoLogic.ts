export const PUBLIC_PROJECTION_VERSION = 2;

const GROUP_ROLES = new Set([
  "group leader",
  "deputy group leader",
  "group chairperson",
  "group secretary",
  "group treasurer",
  "group quartermaster",
  "group quartermaster/bo'sun",
  "group bo'sun",
  "group youth champion"
]);

const SECTION_ROLES = new Set([
  "section leader",
  "assistant section leader",
  "programme scouter",
  "scouter"
]);

const YOUTH_SECTIONS = new Set(["beavers", "cubs", "scouts", "ventures", "rovers"]);

function roleKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAllowedPublicAppointment(role: string, section: string): boolean {
  const sectionKey = section.toLowerCase().trim();
  if (YOUTH_SECTIONS.has(sectionKey)) return SECTION_ROLES.has(roleKey(role));
  return sectionKey === "group" && GROUP_ROLES.has(roleKey(role));
}

export function isCurrentPublicProjection(data: Record<string, unknown>): boolean {
  return data.publicProjectionVersion === PUBLIC_PROJECTION_VERSION
    && data.sourceAccessRole === "leader";
}

export function shouldPublishLeader(input: { active: boolean; showPublicly: boolean; scoutingRole: string; organisationSection: string }): boolean {
  return input.active && input.showPublicly && isAllowedPublicAppointment(input.scoutingRole, input.organisationSection);
}


export type PublicLeadershipAppointment = {
  role: string;
  section: string;
};

export function publicSectionForAppointment(role: string, requestedSection: string): string {
  if (GROUP_ROLES.has(roleKey(role))) return "Group";
  const section = requestedSection.trim();
  return YOUTH_SECTIONS.has(section.toLowerCase()) && SECTION_ROLES.has(roleKey(role)) ? section : "";
}

export function buildPublicLeadershipAppointments(input: {
  appointments?: readonly { appointment?: unknown; scope?: unknown; active?: unknown }[];
  scoutingRole?: unknown;
  organisationSection?: unknown;
  accountSections?: readonly string[];
}): PublicLeadershipAppointment[] {
  const organisationSection = typeof input.organisationSection === "string" ? input.organisationSection.trim() : "";
  const accountSections = (input.accountSections ?? []).filter((section) => typeof section === "string" && section.trim()).map((section) => section.trim());
  const raw = Array.isArray(input.appointments) && input.appointments.length > 0
    ? input.appointments.filter((item) => item?.active !== false).map((item) => ({
        role: typeof item?.appointment === "string" ? item.appointment.trim() : "",
        scope: typeof item?.scope === "string" ? item.scope.trim() : ""
      }))
    : [{ role: typeof input.scoutingRole === "string" ? input.scoutingRole.trim() : "", scope: organisationSection }];

  const result: PublicLeadershipAppointment[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item.role) continue;
    if (GROUP_ROLES.has(roleKey(item.role))) {
      const key = `${roleKey(item.role)}\u0000group`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ role: item.role, section: "Group" });
      }
      continue;
    }
    if (!SECTION_ROLES.has(roleKey(item.role))) continue;
    const explicitCandidates = [item.scope, organisationSection]
      .map((section) => section.trim())
      .filter((section) => YOUTH_SECTIONS.has(section.toLowerCase()));
    const candidates = explicitCandidates.length > 0
      ? explicitCandidates
      : accountSections.filter((section) => YOUTH_SECTIONS.has(section.toLowerCase()));
    for (const section of candidates) {
      const key = `${roleKey(item.role)}\u0000${section.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ role: item.role, section });
    }
  }
  return result;
}

export function shouldPublishLeaderAppointments(input: {
  active: boolean;
  showPublicly: boolean;
  appointments?: readonly { appointment?: unknown; scope?: unknown; active?: unknown }[];
  scoutingRole?: unknown;
  organisationSection?: unknown;
  accountSections?: readonly string[];
}): boolean {
  return input.active && input.showPublicly && buildPublicLeadershipAppointments(input).length > 0;
}
