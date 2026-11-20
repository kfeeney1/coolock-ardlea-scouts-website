import { activeScoutingAppointments, normalizeScoutingAppointmentAssignments } from "./scoutingAppointments.ts";

type Profile = { role: string; scoutingRole?: string; appointments?: unknown };

export function equipmentReportAccess(profile: Profile | null) {
  const groupAppointments = activeScoutingAppointments(
    normalizeScoutingAppointmentAssignments(profile?.appointments, profile?.scoutingRole)
  ).filter(({ scope }) => scope === "Group");
  const canExport = groupAppointments.some(({ appointment }) => appointment === "Group Quartermaster / Bo'sun");
  return {
    canExport,
    canOpen: canExport || profile?.role === "super-admin"
      || groupAppointments.some(({ appointment }) => appointment === "Group Leader")
  };
}
