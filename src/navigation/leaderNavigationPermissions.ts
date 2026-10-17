import { effectivePermissionsFor } from "../security/permissionRegistry.ts";
import { activeScoutingAppointments, normalizeScoutingAppointment, normalizeScoutingAppointmentAssignments } from "../security/scoutingAppointments.ts";
import type { LeaderNavItem } from "./leaderNavigation.ts";

type Profile = { role: string; scoutingRole: string; appointments?: unknown };
/** Shared by both presentations. Route and data guards remain independent. */
export function leaderNavigationFilter(profile: Profile | null) {
  const permissions = new Set(profile ? effectivePermissionsFor(profile.role, profile.scoutingRole, profile.appointments).map((permission) => permission.id) : []);
  const has = (...ids: string[]) => ids.some((id) => permissions.has(id));
  const assignments = profile ? activeScoutingAppointments(normalizeScoutingAppointmentAssignments(profile.appointments, profile.scoutingRole)) : [];
  const appointments = new Set(assignments.map((item) => item.appointment));
  const admin = has("settings.session.manage");
  return (item: LeaderNavItem) => {
    if (!profile) return false;
    if (item.appointments && !admin && !item.appointments.some((appointment) => { const canonical = normalizeScoutingAppointment(appointment); return canonical !== "" && appointments.has(canonical); })) return false;
    if (item.adminOnly && !admin) return false;
    if (item.superAdminOnly && !has("system.superadmin.protect")) return false;
    if (item.leaderAccessOnly && !has("roles.manage.operational", "roles.delegate.operational")) return false;
    if (item.activityLogOnly && !has("audit.read")) return false;
    if (item.settingsOnly && !has("settings.session.manage", "settings.subs.manage")) return false;
    if (item.joinManagementOnly && !has("join.manage")) return false;
    return true;
  };
}
