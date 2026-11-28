import { YOUTH_SECTION_NAMES } from "../services/leaderAccessLogic";
import type { AdminProfile } from "../components/admin/AdminAuthProvider";
import { activeScoutingAppointments, isGroupLeadershipAppointment } from "./scoutingAppointments";

export function canViewJoinManagement(profile: Pick<AdminProfile, "role" | "appointments"> | null): boolean {
  if (!profile) return false;
  if (profile.role === "admin" || profile.role === "super-admin") return true;

  return activeScoutingAppointments(profile.appointments).some(({ appointment, scope }) =>
    (scope !== "Group" && appointment === "Section Leader") ||
    (scope === "Group" && isGroupLeadershipAppointment(appointment))
  );
}


export function waitingListEntrySections(profile: Pick<AdminProfile, "role" | "sections"> | null): string[] {
  if (!profile) return [];
  const groupWide = profile.role !== "leader" || profile.sections.includes("Group");
  return YOUTH_SECTION_NAMES.filter((section) => groupWide || profile.sections.includes(section));
}
