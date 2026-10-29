import { normalizeScoutingAppointment, isGroupScopedAppointment } from "./scoutingAppointments.ts";
import { groupLocalDate } from "../services/groupLocalDate.ts";
import { isCanonicalDateOnly } from "../services/weeklyMeetingProgrammeLogic.ts";

/** Council is an operational appointment grant, never an automatic system-role grant. */
export function canManageHallBookings(profile: Record<string, unknown> | null, organisation: Record<string, unknown> | null, today = groupLocalDate()): boolean {
  if (!profile || !organisation || profile.active !== true || organisation.active !== true || !["leader", "admin", "super-admin"].includes(String(profile.role)) || !Array.isArray(profile.sections) || !profile.sections.length || "section" in profile) return false;
  const appointments = "appointments" in organisation ? organisation.appointments : [{appointment: organisation.scoutingRole, scope: organisation.organisationSection, active: true}];
  if (!Array.isArray(appointments) || appointments.length > 12) return false;
  return appointments.some(raw => {
    if (!raw || typeof raw !== "object" || raw.active === false || (raw.active !== undefined && raw.active !== true)) return false;
    const appointment = normalizeScoutingAppointment(raw.appointment);
    if (!appointment || !(isGroupScopedAppointment(appointment) || ["Section Leader", "Assistant Section Leader"].includes(appointment))) return false;
    const validBound = (value: unknown) => value === undefined || value === "" || (typeof value === "string" && isCanonicalDateOnly(value));
    if (!validBound(raw.startDate) || !validBound(raw.endDate) || (raw.startDate && raw.endDate && raw.startDate > raw.endDate)) return false;
    return (!raw.startDate || raw.startDate <= today) && (!raw.endDate || raw.endDate >= today);
  });
}
