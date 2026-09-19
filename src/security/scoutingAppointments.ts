export const CANONICAL_SCOUTING_APPOINTMENTS = [
  "Group Leader",
  "Deputy Group Leader",
  "Group Secretary",
  "Group Treasurer",
  "Group Quartermaster / Bo'sun",
  "Group Chairperson",
  "Group Youth Champion",
  "Section Leader",
  "Assistant Section Leader",
  "Programme Scouter",
  "Scouter"
] as const;

export type CanonicalScoutingAppointment = typeof CANONICAL_SCOUTING_APPOINTMENTS[number];

const APPOINTMENT_ALIASES: Record<string, CanonicalScoutingAppointment> = {
  "group leader": "Group Leader",
  "deputy group leader": "Deputy Group Leader",
  "deputy-group-leader": "Deputy Group Leader",
  "deputy grouplead": "Deputy Group Leader",
  "dgl": "Deputy Group Leader",
  "group secretary": "Group Secretary",
  "group treasurer": "Group Treasurer",
  "group quartermaster": "Group Quartermaster / Bo'sun",
  "group quartermaster/bo'sun": "Group Quartermaster / Bo'sun",
  "group quartermaster / bo'sun": "Group Quartermaster / Bo'sun",
  "group bo'sun": "Group Quartermaster / Bo'sun",
  "group chairperson": "Group Chairperson",
  "group youth champion": "Group Youth Champion",
  "section leader": "Section Leader",
  "assistant section leader": "Assistant Section Leader",
  "programme scouter": "Programme Scouter",
  "scouter": "Scouter"
};

function appointmentKey(value: unknown): string {
  return typeof value === "string"
    ? value.toLowerCase().replace(/[’‘]/g, "'").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim()
    : "";
}

export function normalizeScoutingAppointment(value: unknown): CanonicalScoutingAppointment | "" {
  const key = appointmentKey(value);
  return key ? APPOINTMENT_ALIASES[key] ?? "" : "";
}

export function isGroupLeadershipAppointment(value: unknown): boolean {
  const canonical = normalizeScoutingAppointment(value);
  return canonical === "Group Leader" || canonical === "Deputy Group Leader";
}


export type ScoutingAppointmentAssignment = {
  id: string;
  appointment: CanonicalScoutingAppointment;
  scope: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
};

function stableAppointmentId(appointment: CanonicalScoutingAppointment, scope: string): string {
  return `${appointmentKey(appointment).replace(/[^a-z0-9]+/g, "-")}--${scope.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-") || "group"}`;
}

export function normalizeScoutingAppointmentAssignments(
  value: unknown,
  legacyAppointment: unknown = "",
  legacyScope: unknown = "Group"
): ScoutingAppointmentAssignment[] {
  const source = Array.isArray(value) ? value : [];
  const normalized: ScoutingAppointmentAssignment[] = [];
  const seen = new Set<string>();
  for (const raw of source) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const appointment = normalizeScoutingAppointment(item.appointment);
    const scope = typeof item.scope === "string" && item.scope.trim() ? item.scope.trim().slice(0, 80) : "Group";
    if (!appointment) continue;
    const id = stableAppointmentId(appointment, scope);
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push({
      id,
      appointment,
      scope,
      active: item.active !== false,
      ...(typeof item.startDate === "string" && item.startDate ? { startDate: item.startDate.slice(0, 10) } : {}),
      ...(typeof item.endDate === "string" && item.endDate ? { endDate: item.endDate.slice(0, 10) } : {})
    });
  }
  if (normalized.length === 0) {
    const appointment = normalizeScoutingAppointment(legacyAppointment);
    const scope = typeof legacyScope === "string" && legacyScope.trim() ? legacyScope.trim().slice(0, 80) : "Group";
    if (appointment) normalized.push({ id: stableAppointmentId(appointment, scope), appointment, scope, active: true });
  }
  return normalized;
}

export function activeScoutingAppointments(assignments: readonly ScoutingAppointmentAssignment[]): ScoutingAppointmentAssignment[] {
  const today = new Date().toISOString().slice(0, 10);
  return assignments.filter((item) => item.active && (!item.startDate || item.startDate <= today) && (!item.endDate || item.endDate >= today));
}

export function hasGroupLeadershipAppointment(value: unknown, legacyAppointment: unknown = ""): boolean {
  const assignments = normalizeScoutingAppointmentAssignments(value, legacyAppointment);
  return activeScoutingAppointments(assignments).some((item) => isGroupLeadershipAppointment(item.appointment));
}

export function hasGroupFinanceAppointment(value: unknown, legacyAppointment: unknown = ""): boolean {
  return activeScoutingAppointments(normalizeScoutingAppointmentAssignments(value, legacyAppointment))
    .some((item) => isGroupLeadershipAppointment(item.appointment) || item.appointment === "Group Treasurer");
}
