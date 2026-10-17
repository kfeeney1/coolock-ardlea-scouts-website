import { effectivePermissionsFor } from "../security/permissionRegistry.ts";
import { activeScoutingAppointments, normalizeScoutingAppointment, normalizeScoutingAppointmentAssignments } from "../security/scoutingAppointments.ts";
import type { LeaderNavItem } from "./leaderNavigation.ts";

type Profile = { role: string; scoutingRole: string; appointments?: unknown };

/** Each entry is an ANY-of requirement using canonical permission IDs. Unknown
 * destinations are hidden until explicitly reconciled with their route/data policy.
 * Appointment constraints on contextual shortcuts are applied independently below.
 */
export const NAVIGATION_PERMISSIONS: Record<string, readonly string[]> = {
  "dashboard": ["leader.portal.access"],
  "weekly-meetings": ["meetings.manage.section", "weekly-meetings.manage.group"],
  "events-activities": ["events.manage.section"],
  "group-polls": ["leader.portal.access"],
  "badgework": ["badgework.manage.section", "badgework.manage.group", "badgework.read.group"],
  "programme-equipment": ["equipment.loan.section"],
  "member-management": ["members.read.section", "members.read.group"],
  "join-management": ["join.manage"],
  "consent-management": ["consent.manage.section"],
  "event-consent": ["consent.manage.section"],
  "parent-communications": ["members.read.section", "members.read.group"],
  "family-billing": ["finance.manage.section", "finance.manage.group"],
  "treasurer-subs": ["finance.manage.group"],
  "treasurer-floats": ["finance.manage.group"],
  "treasurer-reports": ["reports.section"],
  "treasurer-settings": ["settings.subs.manage"],
  "secretary-meeting-records": ["meetings.manage.section", "meeting-records.read.group"],
  "qm-equipment-stores": ["equipment.manage"],
  "qm-detailed-inventory": ["equipment.manage"],
  "qm-equipment-issues": ["equipment.manage"],
  "qm-reports": ["equipment.manage"],
  "qm-settings": ["equipment.manage"],
  "group-equipment-stores": ["equipment.read.group"],
  "group-section-floats": ["finance.manage.section", "finance.manage.group"],
  "group-subs": ["finance.manage.section", "finance.manage.group"],
  "group-meeting-records": ["meetings.manage.section", "meeting-records.read.group"],
  "attendance-insights": ["reports.section"],
  "reports-exports": ["reports.section"],
  "activity-log": ["audit.read"],
  "roles-permissions": ["leader.portal.access"],
  "leader-requests": ["accounts.approve.leader"],
  "parent-access": ["parents.manage"],
  "leader-access": ["roles.manage.operational", "roles.delegate.operational"],
  "settings": ["settings.session.manage", "settings.subs.manage"],
  "system-information": ["system.superadmin.protect"],
  "my-profile": ["leader.portal.access"],
  "info-faq": ["leader.portal.access"],
  "parent-portal": ["leader.portal.access"]
};
/** Shared by both presentations. Route and data guards remain independent. */
export function leaderNavigationFilter(profile: Profile | null) {
  const permissions = new Set(profile ? effectivePermissionsFor(profile.role, profile.scoutingRole, profile.appointments).map((permission) => permission.id) : []);
  const has = (...ids: string[]) => ids.some((id) => permissions.has(id));
  const assignments = profile ? activeScoutingAppointments(normalizeScoutingAppointmentAssignments(profile.appointments, profile.scoutingRole)) : [];
  const appointments = new Set(assignments.map((item) => item.appointment));
  const admin = has("navigation.appointment-views.all");
  return (item: LeaderNavItem) => {
    if (!profile || !has("leader.portal.access")) return false;
    const required = Object.hasOwn(NAVIGATION_PERMISSIONS, item.id) ? NAVIGATION_PERMISSIONS[item.id] : [];
    if (required.length === 0 || !has(...required)) return false;
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
