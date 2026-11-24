import { namedMembershipAccess } from "./membershipTotalsAccess.ts";
import { activeScoutingAppointments, isGroupScopedAppointment, normalizeScoutingAppointmentAssignments } from "./scoutingAppointments.ts";

export function guardianContactExportAccess(profile: Parameters<typeof namedMembershipAccess>[0]) {
  const named = namedMembershipAccess(profile);
  const appointments = activeScoutingAppointments(normalizeScoutingAppointmentAssignments(profile?.appointments, profile?.scoutingRole));
  const group = named.group || appointments.some(({ appointment, scope }) =>
    scope === "Group" && isGroupScopedAppointment(appointment));
  return { group, sections: named.sections, allowed: group || named.sections.length > 0 };
}
