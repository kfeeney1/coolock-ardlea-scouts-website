import { activeScoutingAppointments, normalizeScoutingAppointmentAssignments } from "./scoutingAppointments.ts";

type Profile = { role: string; scoutingRole?: string; appointments?: unknown };

export function groupSubsReportAccess(profile: Profile | null) {
  const appointments = activeScoutingAppointments(normalizeScoutingAppointmentAssignments(profile?.appointments, profile?.scoutingRole));
  const canExport = appointments.some(({ appointment, scope }) => scope === "Group" && appointment === "Group Treasurer");
  const canOpen = canExport || profile?.role === "super-admin"
    || appointments.some(({ appointment, scope }) => scope === "Group" && appointment === "Group Leader");
  return { canOpen, canExport };
}
