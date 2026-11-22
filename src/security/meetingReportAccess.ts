import { activeScoutingAppointments, normalizeScoutingAppointmentAssignments } from "./scoutingAppointments.ts";

type Profile = { role: string; scoutingRole?: string; appointments?: unknown; sections?: string[] };

export function meetingReportAccess(profile: Profile | null) {
  const assignments = activeScoutingAppointments(normalizeScoutingAppointmentAssignments(profile?.appointments, profile?.scoutingRole));
  const group = profile?.role === "super-admin" || assignments.some(({ appointment, scope }) =>
    scope === "Group" && (appointment === "Group Leader" || appointment === "Group Secretary"));
  const legacy = !Array.isArray(profile?.appointments) || profile.appointments.length === 0;
  const sections = (profile?.sections ?? []).filter(section => assignments.some(({ appointment, scope }) =>
    appointment === "Section Leader" && (scope === section || (legacy && scope === "Group"))));
  return { group, sections, canOpen: group || sections.length > 0 };
}
