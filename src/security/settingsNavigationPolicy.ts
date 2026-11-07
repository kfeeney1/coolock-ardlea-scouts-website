import { activeScoutingAppointments, normalizeScoutingAppointmentAssignments } from "./scoutingAppointments.ts";
import { settingsAccessFor, type SettingsProfile } from "./settingsAccess.ts";

export function settingsRouteAllowed(profile: SettingsProfile | null, search: string): boolean {
  const query = new URLSearchParams(search);
  if (query.getAll("view").length > 1) return false;
  const view = query.get("view");
  if (view === "quartermaster") return settingsAccessFor(profile, "equipment").view;
  if (view === "treasurer") return settingsAccessFor(profile, "subs").view;
  if (view !== null) return false;
  return ["session", "features", "subs", "maintenance-directory"]
    .some(area => settingsAccessFor(profile, area as "session" | "features" | "subs" | "maintenance-directory").view);
}

/** The same finance configuration is shown once, even for multiple appointments
 * or an administrator who can otherwise see every appointment navigation context.
 */
export function settingsMenuDestination(profile: SettingsProfile | null): "settings" | "treasurer-settings" | null {
  if (!settingsRouteAllowed(profile, "")) return null;
  if (settingsAccessFor(profile, "session").view || settingsAccessFor(profile, "features").view) return "settings";
  const treasurer = profile && activeScoutingAppointments(normalizeScoutingAppointmentAssignments(profile.appointments, profile.scoutingRole))
    .some(item => item.appointment === "Group Treasurer" && item.scope === "Group");
  return treasurer ? "treasurer-settings" : "settings";
}
