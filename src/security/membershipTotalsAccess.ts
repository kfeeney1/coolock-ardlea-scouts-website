import { hasChairpersonReportAccess } from "./chairpersonReportAccess.ts";
import { activeScoutingAppointments, normalizeScoutingAppointmentAssignments } from "./scoutingAppointments.ts";

type Profile = { role: string; scoutingRole?: string; appointments?: unknown; sections?: string[] };

export function membershipTotalsAccess(profile: Profile | null) {
  const access = membershipAccess(profile, true);
  const chairperson = !access.group && hasChairpersonReportAccess(profile);
  return { ...access, chairperson, canExport: access.canOpen, canOpen: access.canOpen || chairperson };
}

export function namedMembershipAccess(profile: Profile | null) {
  return membershipAccess(profile, false);
}

function membershipAccess(profile: Profile | null, includeAdmin: boolean) {
  const assignments = activeScoutingAppointments(normalizeScoutingAppointmentAssignments(profile?.appointments, profile?.scoutingRole));
  const group = (profile?.role === "super-admin" || (includeAdmin && profile?.role === "admin")) || assignments.some(({ appointment, scope }) =>
    scope === "Group" && (appointment === "Group Leader" || appointment === "Group Secretary"));
  const legacy = !Array.isArray(profile?.appointments) || profile.appointments.length === 0;
  const sections = (profile?.sections ?? []).filter(section => assignments.some(({ appointment, scope }) =>
    appointment === "Section Leader" && (scope === section || (legacy && scope === "Group"))));
  return { group, sections, canOpen: group || sections.length > 0 };
}
