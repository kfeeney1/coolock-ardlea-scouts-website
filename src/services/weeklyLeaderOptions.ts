import { activeScoutingAppointments, normalizeScoutingAppointmentAssignments } from "../security/scoutingAppointments.ts";

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
const SECTION_LEADER_ROLES = ["Section Leader", "Assistant Section Leader", "Programme Scouter", "Scouter"];

export type WeeklyLeaderOption = {
  id: string;
  displayName: string;
  scoutingRole: string;
  organisationSection: string;
  organisationOrder: number;
};

export type OrganisationLeaderProfile = {
  id: string;
  data: Record<string, unknown>;
};

export function weeklyLeaderOptionsFromProfiles(
  profiles: OrganisationLeaderProfile[],
  sections: string[],
  isGroupWide: boolean
): WeeklyLeaderOption[] {
  const requested = new Set(isGroupWide ? GROUP_SECTIONS : sections.map((section) => section.trim()).filter(Boolean));
  if (!requested.size) return [];

  return profiles.flatMap(({ id, data }) => {
    if (data.active !== true) return [];
    const displayName = typeof data.displayName === "string" ? data.displayName.trim() : "";
    if (!displayName) return [];
    const appointments = activeScoutingAppointments(normalizeScoutingAppointmentAssignments(data.appointments, data.scoutingRole, data.organisationSection));
    return appointments
      .filter((appointment) => requested.has(appointment.scope) && SECTION_LEADER_ROLES.includes(appointment.appointment))
      .map((appointment) => ({
        id,
        displayName,
        scoutingRole: appointment.appointment,
        organisationSection: appointment.scope,
        organisationOrder: typeof data.organisationOrder === "number" ? data.organisationOrder : 9999
      }));
  })
    .filter((leader, index, all) => all.findIndex((candidate) => candidate.id === leader.id && candidate.scoutingRole === leader.scoutingRole && candidate.organisationSection === leader.organisationSection) === index)
    .sort((a, b) => a.organisationSection.localeCompare(b.organisationSection) || a.organisationOrder - b.organisationOrder || a.displayName.localeCompare(b.displayName));
}
