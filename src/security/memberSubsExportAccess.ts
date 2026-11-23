import { groupFinanceReportAccess } from "./groupFinanceReportAccess.ts";
import { activeScoutingAppointments, normalizeScoutingAppointmentAssignments } from "./scoutingAppointments.ts";

type Profile = { role: string; scoutingRole?: string; appointments?: unknown; sections?: string[] };

export function memberSubsExportAccess(profile: Profile | null) {
  const group = groupFinanceReportAccess(profile).canExport;
  const legacy = !Array.isArray(profile?.appointments) || profile.appointments.length === 0;
  const appointments = activeScoutingAppointments(normalizeScoutingAppointmentAssignments(profile?.appointments, profile?.scoutingRole));
  const sections = (profile?.sections ?? []).filter(section => section !== "Group" && appointments.some(({ appointment, scope }) =>
    appointment === "Section Leader" && (scope === section || (legacy && scope === "Group"))));
  return { group, sections };
}

export function canExportMemberSubs(
  access: ReturnType<typeof memberSubsExportAccess>,
  memberSection: string,
  assignment: { section: string; accountId?: string }
) {
  return access.group || (!assignment.accountId
    && access.sections.includes(memberSection) && access.sections.includes(assignment.section));
}
