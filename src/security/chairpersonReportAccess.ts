import { activeScoutingAppointments, normalizeScoutingAppointmentAssignments } from "./scoutingAppointments.ts";

export function hasChairpersonReportAccess(profile: { appointments?: unknown; scoutingRole?: string } | null) {
  return activeScoutingAppointments(normalizeScoutingAppointmentAssignments(profile?.appointments, profile?.scoutingRole))
    .some(({ appointment, scope }) => appointment === "Group Chairperson" && scope === "Group");
}
