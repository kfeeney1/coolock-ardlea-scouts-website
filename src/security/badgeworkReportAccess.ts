import { activeScoutingAppointments, normalizeScoutingAppointmentAssignments } from "./scoutingAppointments.ts";

type Profile = { role: string; scoutingRole?: string; appointments?: unknown; sections?: string[] };

export function badgeworkReportAccess(profile: Profile | null) {
  const assignments = activeScoutingAppointments(
    normalizeScoutingAppointmentAssignments(profile?.appointments, profile?.scoutingRole)
  );
  const group = profile?.role === "super-admin" || assignments.some(({ appointment, scope }) =>
    scope === "Group" && (appointment === "Group Leader" || appointment === "Group Secretary")
  );
  const legacy = !Array.isArray(profile?.appointments) || profile.appointments.length === 0;
  const exportSections = (profile?.sections ?? []).filter(section => assignments.some(({ appointment, scope }) =>
    (appointment === "Section Leader" || appointment === "Programme Scouter")
    && (scope === section || (legacy && scope === "Group"))));
  return { group, exportSections, canOpen: group || exportSections.length > 0 };
}
