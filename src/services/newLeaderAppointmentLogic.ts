import { canonicalLeaderAppointments } from "./leaderAccessLogic.ts";
import { normalizeScoutingAppointment, type CanonicalScoutingAppointment, type ScoutingAppointmentAssignment } from "../security/scoutingAppointments.ts";

export const DEFAULT_NEW_LEADER_APPOINTMENT: CanonicalScoutingAppointment = "Programme Scouter";

export function newLeaderAppointments(
  section: string,
  selected: readonly string[] = [DEFAULT_NEW_LEADER_APPOINTMENT]
): ScoutingAppointmentAssignment[] {
  const appointments = selected.map(normalizeScoutingAppointment);
  if (appointments.some((appointment) => !appointment)) throw new Error("Unsupported Scouting appointment.");
  return canonicalLeaderAppointments(
    appointments.map((appointment) => ({ appointment, scope: section, active: true })),
    [section],
    "",
    section
  );
}
