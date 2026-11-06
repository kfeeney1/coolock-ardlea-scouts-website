import type { PermissionDefinition, PermissionGrant, PermissionScope } from "./permissionRegistry.ts";

// Approved SW-275 P1, decision record SW-580. Runtime consumer reads are
// deliberately separate from permission to open a configuration editor.
const system: PermissionGrant[] = ["admin", "super-admin"];
const finance: PermissionGrant[] = ["Group Leader", "Group Treasurer", ...system];
const equipment: PermissionGrant[] = ["Group Leader", "Group Quartermaster / Bo'sun", ...system];

function permission(id: string, name: string, scope: PermissionScope, grantedBy: PermissionGrant[], enforcement: string): PermissionDefinition {
  return { id, name, description: name, area: "Settings", scope, grantedBy, enforcement: [enforcement], protected: true };
}

export const SETTINGS_PERMISSIONS: PermissionDefinition[] = [
  permission("settings.session.view", "View session configuration", "system", system, "Firestore siteSettings/session get; Settings route and panel"),
  permission("settings.features.view", "View feature and navigation configuration", "system", ["super-admin"], "Firestore canonical siteSettings; Settings route and panel"),
  permission("settings.features.manage", "Change feature and navigation configuration", "system", ["super-admin"], "Firestore siteSettings validated create/update; Hall Hire remains paused"),
  permission("settings.subs.view", "View Subs configuration", "group-wide", finance, "Firestore subsRatePolicies; Settings route and panel"),
  permission("settings.equipment.view", "View equipment configuration", "group-wide", equipment, "Firestore equipmentCategories/equipmentLocations; Equipment option manager"),
  permission("settings.equipment.manage", "Manage equipment configuration", "group-wide", equipment, "Firestore equipmentCategories/equipmentLocations validated mutations"),
  permission("settings.maintenance-directory.view", "View maintenance directory repair", "system", system, "Firestore maintenance/group/config/leaders; directory repair panel"),
  permission("settings.maintenance-directory.manage", "Refresh the derived maintenance directory", "system", system, "Firestore maintenance config and leader projections validate canonical sources"),
  permission("settings.monitoring.view", "View operational monitoring", "system", ["super-admin"], "Firestore operationalMonitoring read; protected System Information route")
];
