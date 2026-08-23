export const PUBLIC_PROJECTION_VERSION = 2;

const GROUP_ROLES = new Set([
  "group leader",
  "group chairperson",
  "group secretary",
  "group treasurer",
  "group quartermaster",
  "group quartermaster/bo'sun",
  "group bo'sun",
  "group youth champion"
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
  if (YOUTH_SECTIONS.has(sectionKey)) return role.trim().length > 0;
  return sectionKey === "group" && GROUP_ROLES.has(roleKey(role));
}

export function isCurrentPublicProjection(data: Record<string, unknown>): boolean {
  return data.publicProjectionVersion === PUBLIC_PROJECTION_VERSION
    && typeof data.sourceAccessRole === "string"
    && data.sourceAccessRole.trim().toLowerCase() === "leader";
}
