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
