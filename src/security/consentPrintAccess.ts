import { namedMembershipAccess } from "./membershipTotalsAccess.ts";
import { activeScoutingAppointments, isGroupScopedAppointment, normalizeScoutingAppointmentAssignments } from "./scoutingAppointments.ts";

export function canPrintYouthConsent(profile: Parameters<typeof namedMembershipAccess>[0], section: string) {
  const appointments = activeScoutingAppointments(normalizeScoutingAppointmentAssignments(profile?.appointments, profile?.scoutingRole));
  return appointments.some(assignment => assignment.scope === "Group" && isGroupScopedAppointment(assignment.appointment))
    || namedMembershipAccess(profile).sections.includes(section);
}
