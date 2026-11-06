import { effectivePermissionsFor } from "./permissionRegistry.ts";
import { isGroupScopedAppointment, normalizeScoutingAppointmentAssignments } from "./scoutingAppointments.ts";

export type SettingsProfile = {
  role: string;
  scoutingRole: string;
  appointments?: unknown;
};

export type SettingsArea = "session" | "features" | "subs" | "equipment" | "maintenance-directory" | "monitoring";

const capabilities: Record<SettingsArea, { view: string; edit?: string }> = {
  session: { view: "settings.session.view", edit: "settings.session.manage" },
  features: { view: "settings.features.view", edit: "settings.features.manage" },
  subs: { view: "settings.subs.view", edit: "settings.subs.manage" },
  equipment: { view: "settings.equipment.view", edit: "settings.equipment.manage" },
  "maintenance-directory": { view: "settings.maintenance-directory.view", edit: "settings.maintenance-directory.manage" },
  monitoring: { view: "settings.monitoring.view" }
};

/** Presentation policy for an authenticated, active profile. Data Rules remain
 * authoritative; callers must discard this profile when account access changes.
 * It never grants delete/reset from edit access or turns consumer reads into menus.
 */
export function settingsAccessFor(profile: SettingsProfile | null, area: SettingsArea) {
  const denied = { menu: false, view: false, edit: false, create: false, delete: false, reset: false };
  if (!profile || !["leader", "admin", "super-admin"].includes(profile.role)) return denied;
  const requirement = Object.hasOwn(capabilities, area) ? capabilities[area] : undefined;
  if (!requirement) return denied;
  const assignments = normalizeScoutingAppointmentAssignments(profile.appointments, profile.scoutingRole)
    .filter(item => !isGroupScopedAppointment(item.appointment) || item.scope === "Group");
  // Do not revive a legacy label when current assignments were removed for scope.
  const permissions = new Set(effectivePermissionsFor(profile.role, "", assignments).map(item => item.id));
  const view = permissions.has(requirement.view);
  const edit = view && Boolean(requirement.edit && permissions.has(requirement.edit));
  return { ...denied, menu: view, view, edit, create: edit };
}
