import { eventConsentReportAccess } from "./eventConsentReportAccess.ts";
import { activeScoutingAppointments, isGroupScopedAppointment, normalizeScoutingAppointmentAssignments } from "./scoutingAppointments.ts";

export function eventRosterExportAccess(profile: Parameters<typeof eventConsentReportAccess>[0]) {
  const { sections } = eventConsentReportAccess(profile);
  const appointments = activeScoutingAppointments(normalizeScoutingAppointmentAssignments(profile?.appointments, profile?.scoutingRole));
  const group = appointments.some(({ appointment, scope }) => scope === "Group" && isGroupScopedAppointment(appointment));
  return { group, sections, allowed: group || sections.length > 0 };
}
