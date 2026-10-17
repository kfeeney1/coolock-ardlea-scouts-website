export type LeaderNavItem = {
  id: string;
  label: string;
  path: string;
  pageId: string;
  permissions: readonly string[];
  identity: { testId: string } | { heading: string; level?: number };
  parentPath: string | null;
  inAppBack: { label: string; path: string } | null;
  historyBack: "previous-route-after-menu-dismissal";
  exactPath?: boolean;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  leaderAccessOnly?: boolean;
  activityLogOnly?: boolean;
  settingsOnly?: boolean;
  joinManagementOnly?: boolean;
  appointments?: string[];
};

export type LeaderNavGroup = { id: string; label: string; items: LeaderNavItem[] };


/** Metadata describes the existing controls; parentPath does not fabricate a
 * browser-history entry or add a Back button to pages that have none. */
function destination(item: Omit<LeaderNavItem, "parentPath" | "inAppBack" | "historyBack"> & Partial<Pick<LeaderNavItem, "parentPath" | "inAppBack">>): LeaderNavItem {
  return { parentPath: "/leader", inAppBack: null, historyBack: "previous-route-after-menu-dismissal", ...item };
}

const quartermasterAppointments = ["Group Quartermaster / Bo'sun", "Group Quartermaster", "Group Bo'sun", "Group Bosun"];

export const dashboardNavItem: LeaderNavItem = destination({ id: "dashboard", label: "Dashboard", path: "/leader", pageId: "leader-dashboard", permissions: ["leader.portal.access"], identity: {testId: "admin-overview"}, parentPath: null });

export const leaderNavGroups: LeaderNavGroup[] = [
  { id: "programme", label: "Programme", items: [
    destination({ id: "weekly-meetings", label: "Weekly Meetings", path: "/leader/weekly", pageId: "weekly-meetings", permissions: ["meetings.manage.section", "weekly-meetings.manage.group"], identity: {testId: "page-weekly-meetings"} }),
    destination({ id: "events-activities", label: "Events & Activities", path: "/leader/events", pageId: "events-activities", permissions: ["events.manage.section"], identity: {heading: "Events & Activities", level: 1} }),
    destination({ id: "group-polls", label: "Group Polls", path: "/leader/polls", pageId: "group-polls", permissions: ["leader.portal.access"], identity: {heading: "Group Polls"} }),
    destination({ id: "badgework", label: "Badgework", path: "/leader/badgework", pageId: "badgework", permissions: ["badgework.manage.section", "badgework.manage.group", "badgework.read.group"], identity: {heading: "Adventure Skills Badgework", level: 1} }),
    destination({ id: "programme-equipment", label: "Equipment", path: "/leader/programme-equipment", pageId: "programme-equipment", permissions: ["equipment.loan.section"], identity: {testId: "page-programme-equipment"} })
  ]},
  { id: "people-parents", label: "People & Parents", items: [
    destination({ id: "member-management", label: "Member Management", path: "/leader/members", pageId: "member-management", permissions: ["members.read.section", "members.read.group"], identity: {testId: "page-member-management"} }),
    destination({ id: "join-management", label: "Join Us Management", path: "/leader/join", pageId: "join-management", joinManagementOnly: true, permissions: ["join.manage"], identity: {testId: "page-join-management"} }),
    destination({ id: "consent-management", label: "Consent Management", path: "/leader/consents", pageId: "consent-management", permissions: ["consent.manage.section"], identity: {heading: "Consent Management", level: 1} }),
    destination({ id: "event-consent", label: "Event Consent", path: "/leader/event-consent", pageId: "event-consent", permissions: ["consent.manage.section"], identity: {testId: "page-event-consent"} }),
    destination({ id: "parent-communications", label: "Parent Communications", path: "/leader/communications", pageId: "parent-communications", permissions: ["members.read.section", "members.read.group"], identity: {heading: "Parent Communications", level: 1} }),
    destination({ id: "family-billing", label: "Family Billing Accounts", path: "/leader/subs#family-billing", pageId: "family-billing", permissions: ["finance.manage.section", "finance.manage.group"], identity: {testId: "page-subs"} })
  ]},
  { id: "treasurer", label: "Treasurer", items: [
    destination({ id: "treasurer-subs", label: "Subs", path: "/leader/subs?view=treasurer", pageId: "treasurer-subs", appointments: ["Group Treasurer"], permissions: ["finance.manage.group"], identity: {testId: "page-treasurer-subs"} }),
    destination({ id: "treasurer-floats", label: "Floats", path: "/leader/finance?view=treasurer", pageId: "treasurer-floats", appointments: ["Group Treasurer"], permissions: ["finance.manage.group"], identity: {testId: "page-treasurer-floats"} }),
    destination({ id: "treasurer-reports", label: "Reports", path: "/leader/reports?view=treasurer", pageId: "treasurer-reports", appointments: ["Group Treasurer"], permissions: ["reports.section"], identity: {testId: "page-treasurer-reports"} }),
    destination({ id: "treasurer-settings", label: "Settings", path: "/leader/settings?view=treasurer", pageId: "treasurer-settings", appointments: ["Group Treasurer"], permissions: ["settings.subs.manage"], identity: {testId: "page-treasurer-settings"} })
  ]},
  { id: "secretary", label: "Secretary", items: [
    destination({ id: "secretary-meeting-records", label: "Meeting Records", path: "/leader/meetings?view=secretary", pageId: "secretary-meeting-records", appointments: ["Group Secretary", "Group Chairperson"], permissions: ["meetings.manage.section", "meeting-records.read.group"], identity: {testId: "page-secretary-meeting-records"} })
  ]},
  { id: "quartermaster", label: "Quartermaster / Bo’sun", items: [
    destination({ id: "qm-equipment-stores", label: "Equipment and Stores", path: "/leader/equipment?view=quartermaster", pageId: "qm-equipment-stores", exactPath: true, appointments: quartermasterAppointments, permissions: ["equipment.manage"], identity: {testId: "page-qm-equipment-stores"} }),
    destination({ id: "qm-detailed-inventory", label: "Detailed Inventory", path: "/leader/equipment/inventory?view=quartermaster", pageId: "qm-detailed-inventory", exactPath: true, appointments: quartermasterAppointments, permissions: ["equipment.manage"], identity: {testId: "page-qm-detailed-inventory"}, parentPath: "/leader/equipment?view=quartermaster", inAppBack: { label: "Back to Equipment & Stores", path: "/leader/equipment?view=quartermaster" } }),
    destination({ id: "qm-equipment-issues", label: "Broken, lost & missing", path: "/leader/equipment/issues?view=quartermaster", pageId: "qm-equipment-issues", exactPath: true, appointments: quartermasterAppointments, permissions: ["equipment.manage"], identity: {testId: "page-qm-equipment-issues"}, parentPath: "/leader/equipment?view=quartermaster", inAppBack: { label: "Back to Equipment & Stores", path: "/leader/equipment?view=quartermaster" } }),
    destination({ id: "qm-reports", label: "QM Reports", path: "/leader/qm-reports", pageId: "qm-reports", exactPath: true, appointments: quartermasterAppointments, permissions: ["equipment.manage"], identity: {testId: "page-qm-reports"}, parentPath: "/leader/equipment?view=quartermaster", inAppBack: { label: "Back to Equipment & Stores", path: "/leader/equipment?view=quartermaster" } }),
    destination({ id: "qm-settings", label: "QM Settings", path: "/leader/settings?view=quartermaster", pageId: "qm-settings", exactPath: true, appointments: quartermasterAppointments, permissions: ["equipment.manage"], identity: {testId: "page-qm-settings"} })
  ]},
  { id: "group-operations", label: "Group Operations", items: [
    destination({ id: "group-equipment-stores", label: "Equipment & Stores", path: "/leader/equipment?view=group-operations", pageId: "group-equipment-stores", permissions: ["equipment.read.group"], identity: {testId: "page-group-equipment-stores"} }),
    destination({ id: "group-section-floats", label: "Section Floats", path: "/leader/finance?view=group-operations", pageId: "group-section-floats", permissions: ["finance.manage.section", "finance.manage.group"], identity: {testId: "page-group-section-floats"} }),
    destination({ id: "group-subs", label: "Subs", path: "/leader/subs?view=group-operations", pageId: "group-subs", permissions: ["finance.manage.section", "finance.manage.group"], identity: {testId: "page-group-subs"} }),
    destination({ id: "group-meeting-records", label: "Meeting Records", path: "/leader/meetings?view=group-operations", pageId: "group-meeting-records", permissions: ["meetings.manage.section", "meeting-records.read.group"], identity: {testId: "page-group-meeting-records"} })
  ]},
  { id: "insights-records", label: "Insights & Records", items: [
    destination({ id: "attendance-insights", label: "Attendance Insights", path: "/leader/attendance", pageId: "attendance-insights", permissions: ["reports.section"], identity: {heading: "Attendance History & Insights", level: 1} }),
    destination({ id: "reports-exports", label: "Reports & Exports", path: "/leader/reports?view=insights", pageId: "reports-exports", permissions: ["reports.section"], identity: {testId: "page-reports-exports"} }),
    destination({ id: "activity-log", label: "Activity Log", path: "/leader/activity", pageId: "activity-log", activityLogOnly: true, permissions: ["audit.read"], identity: {heading: "Activity Log", level: 1} })
  ]},
  { id: "administration", label: "Administration", items: [
    destination({ id: "roles-permissions", label: "Roles & Permissions", path: "/leader/roles", pageId: "roles-permissions", permissions: ["leader.portal.access"], identity: {heading: "Roles & Permissions", level: 1} }),
    destination({ id: "leader-requests", label: "Leader Requests", path: "/leader/requests", pageId: "leader-requests", adminOnly: true, permissions: ["accounts.approve.leader"], identity: {heading: "Leader Requests", level: 1} }),
    destination({ id: "parent-access", label: "Parent Access", path: "/leader/parent-access", pageId: "parent-access", adminOnly: true, permissions: ["parents.manage"], identity: {heading: "Parent Management", level: 1} }),
    destination({ id: "leader-access", label: "Leader Access", path: "/leader/access", pageId: "leader-access", leaderAccessOnly: true, permissions: ["roles.manage.operational", "roles.delegate.operational"], identity: {heading: "Leader Access & Organisation", level: 1} }),
    destination({ id: "settings", label: "Settings", path: "/leader/settings", pageId: "settings", settingsOnly: true, permissions: ["settings.session.manage", "settings.subs.manage"], identity: {testId: "page-settings"} }),
    destination({ id: "system-information", label: "System Information", path: "/leader/system", pageId: "system-information", superAdminOnly: true, permissions: ["system.superadmin.protect"], identity: {heading: "System Information", level: 1} })
  ]}
];

export const accountNavItems: LeaderNavItem[] = [
  destination({ id: "my-profile", label: "My Profile", path: "/leader/profile", pageId: "my-profile", permissions: ["leader.portal.access"], identity: {heading: "My Profile", level: 1} }),
  destination({ id: "info-faq", label: "Info & FAQ", path: "/leader/info", pageId: "info-faq", permissions: ["leader.portal.access"], identity: {heading: "Leader Portal Information", level: 1} }),
  destination({ id: "parent-portal", label: "View Parent Portal ↗", path: "/parent", pageId: "parent-portal", permissions: ["leader.portal.access"], identity: {heading: "Parent Portal", level: 1}, parentPath: null })
];

/** Presentation order is explicit; existing order remains the declared array order. */
export const redesignedCategoryOrder = ["programme", "people-parents", "secretary", "quartermaster", "group-operations", "treasurer", "insights-records", "administration", "super-admin"] as const;

export function redesignedNavigationGroups(groups: LeaderNavGroup[]): LeaderNavGroup[] {
  return groups.flatMap((group) => {
    if (group.id !== "administration") return [group];
    const ordinary = group.items.filter((item) => !item.superAdminOnly);
    const system = group.items.filter((item) => item.superAdminOnly);
    return [
      ...(ordinary.length ? [{ ...group, items: ordinary }] : []),
      ...(system.length ? [{ id: "super-admin", label: "Super Admin", items: system }] : [])
    ];
  }).sort((a, b) => redesignedCategoryOrder.indexOf(a.id as typeof redesignedCategoryOrder[number]) - redesignedCategoryOrder.indexOf(b.id as typeof redesignedCategoryOrder[number]));
}

export const leaderNavigationDestinations = [dashboardNavItem, ...leaderNavGroups.flatMap((group) => group.items), ...accountNavItems];
export const navigationPermissions: Record<string, readonly string[]> = Object.fromEntries(leaderNavigationDestinations.map((item) => [item.id, item.permissions]));

/** These are actual redirects, unlike query-less workspaces which remain valid
 * independent routes with their own page identities and are not rewritten. */
export const leaderLegacyRedirects = { "/leader/member-history": "/leader/members" } as const;

/** Safe parents used by the existing history-aware record Back bridge. Explicit
 * edit controls and unsaved-change guards still govern their own transitions. */
export const RECORD_PARENT_ROUTES = [
  { prefix: "/leader/members/", parent: "/leader/members" },
  { prefix: "/leader/events/", parent: "/leader/events" },
  { prefix: "/leader/join/", parent: "/leader/join" },
  { prefix: "/leader/consents/", parent: "/leader/consents" }
] as const;

/** Supported contextless saved links are not aliases and are not redirected. */
export const leaderContextlessRoutes = [
  { path: "/leader/equipment", testId: "page-equipment-stores" },
  { path: "/leader/equipment/inventory", testId: "page-qm-detailed-inventory" },
  { path: "/leader/finance", testId: "page-section-floats" },
  { path: "/leader/subs", testId: "page-subs" },
  { path: "/leader/reports", testId: "page-leader-reports" },
  { path: "/leader/meetings", testId: "page-meeting-records" }
] as const;
