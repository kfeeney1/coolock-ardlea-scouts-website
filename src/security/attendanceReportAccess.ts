import { activeScoutingAppointments, normalizeScoutingAppointmentAssignments } from "./scoutingAppointments.ts";

type Profile = {
  role: string;
  scoutingRole?: string;
  appointments?: unknown;
  sections?: string[];
};

export function attendanceReportScope(profile: Profile | null, report: "named" | "aggregate") {
  const sections = profile?.sections ?? [];
  const assignments = activeScoutingAppointments(
    normalizeScoutingAppointmentAssignments(profile?.appointments, profile?.scoutingRole)
  );
  const isAdmin = profile?.role === "super-admin"
    || (report === "aggregate" && profile?.role === "admin")
    || assignments.some(({ appointment, scope }) => appointment === "Group Leader" && scope === "Group");
  const legacy = !Array.isArray(profile?.appointments) || profile.appointments.length === 0;
  const allowedSections = [...new Set(sections.filter(section => assignments.some(({ appointment, scope }) =>
    (appointment === "Section Leader" || appointment === "Programme Scouter")
    && (scope === section || (legacy && scope === "Group"))
  )))];
  return { isAdmin, sections: allowedSections, allowed: isAdmin || allowedSections.length > 0 };
}
