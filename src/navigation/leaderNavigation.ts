export type LeaderNavItem = {
  id: string;
  label: string;
  path: string;
  pageId: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  leaderAccessOnly?: boolean;
  activityLogOnly?: boolean;
  settingsOnly?: boolean;
  appointments?: string[];
};

export type LeaderNavGroup = { id: string; label: string; items: LeaderNavItem[] };

const quartermasterAppointments = ["Group Quartermaster", "Group Bo'sun", "Group Bosun"];

export const dashboardNavItem: LeaderNavItem = { id: "dashboard", label: "Dashboard", path: "/leader", pageId: "leader-dashboard" };

export const leaderNavGroups: LeaderNavGroup[] = [
  { id: "programme", label: "Programme", items: [
    { id: "weekly-meetings", label: "Weekly Meetings", path: "/leader/weekly", pageId: "weekly-meetings" },
    { id: "events-activities", label: "Events & Activities", path: "/leader/events", pageId: "events-activities" },
    { id: "badgework", label: "Badgework", path: "/leader/badgework", pageId: "badgework" }
  ]},
  { id: "people-parents", label: "People & Parents", items: [
    { id: "member-management", label: "Member Management", path: "/leader/members", pageId: "member-management" },
    { id: "join-management", label: "Join Us Management", path: "/leader/join", pageId: "join-management" },
    { id: "consent-management", label: "Consent Management", path: "/leader/consents", pageId: "consent-management" },
    { id: "event-consent", label: "Event Consent", path: "/leader/event-consent", pageId: "event-consent" },
    { id: "parent-communications", label: "Parent Communications", path: "/leader/communications", pageId: "parent-communications" },
    { id: "family-billing", label: "Family Billing Accounts", path: "/leader/subs#family-billing", pageId: "family-billing" }
  ]},
  { id: "secretary", label: "Secretary", items: [
    { id: "secretary-subs", label: "Subs", path: "/leader/subs", pageId: "subs", appointments: ["Group Secretary"] },
    { id: "secretary-floats", label: "Floats", path: "/leader/finance", pageId: "section-floats", appointments: ["Group Secretary"] },
    { id: "secretary-reports", label: "Secretary Reports", path: "/leader/reports", pageId: "secretary-reports", appointments: ["Group Secretary", "Group Chairperson"] },
    { id: "secretary-settings", label: "Secretary Settings", path: "/leader/settings", pageId: "secretary-settings", appointments: ["Group Secretary"] },
    { id: "secretary-meeting-records", label: "Meeting Records", path: "/leader/meetings", pageId: "meeting-records", appointments: ["Group Secretary", "Group Chairperson"] }
  ]},
  { id: "quartermaster", label: "Quartermaster / Bo’sun", items: [
    { id: "qm-equipment-stores", label: "Equipment and Stores", path: "/leader/equipment", pageId: "equipment-stores", appointments: quartermasterAppointments },
    { id: "qm-reports", label: "QM Reports", path: "/leader/qm-reports", pageId: "qm-reports", appointments: quartermasterAppointments },
    { id: "qm-settings", label: "QM Settings", path: "/leader/settings", pageId: "qm-settings", appointments: quartermasterAppointments }
  ]},
  { id: "group-operations", label: "Group Operations", items: [
    { id: "group-equipment-stores", label: "Equipment & Stores", path: "/leader/equipment", pageId: "equipment-stores" },
    { id: "group-section-floats", label: "Section Floats", path: "/leader/finance", pageId: "section-floats" },
    { id: "group-subs", label: "Subs", path: "/leader/subs", pageId: "subs" },
    { id: "group-meeting-records", label: "Meeting Records", path: "/leader/meetings", pageId: "meeting-records" }
  ]},
  { id: "insights-records", label: "Insights & Records", items: [
    { id: "attendance-insights", label: "Attendance Insights", path: "/leader/attendance", pageId: "attendance-insights" },
    { id: "reports-exports", label: "Reports & Exports", path: "/leader/reports", pageId: "secretary-reports" },
    { id: "activity-log", label: "Activity Log", path: "/leader/activity", pageId: "activity-log", activityLogOnly: true }
  ]},
  { id: "administration", label: "Administration", items: [
    { id: "roles-permissions", label: "Roles & Permissions", path: "/leader/roles", pageId: "roles-permissions" },
    { id: "leader-requests", label: "Leader Requests", path: "/leader/requests", pageId: "leader-requests", adminOnly: true },
    { id: "parent-access", label: "Parent Access", path: "/leader/parent-access", pageId: "parent-access", adminOnly: true },
    { id: "leader-access", label: "Leader Access", path: "/leader/access", pageId: "leader-access", leaderAccessOnly: true },
    { id: "settings", label: "Settings", path: "/leader/settings", pageId: "settings", settingsOnly: true },
    { id: "system-information", label: "System Information", path: "/leader/system", pageId: "system-information", superAdminOnly: true }
  ]}
];

export const accountNavItems: LeaderNavItem[] = [
  { id: "my-profile", label: "My Profile", path: "/leader/profile", pageId: "my-profile" },
  { id: "info-faq", label: "Info & FAQ", path: "/leader/info", pageId: "info-faq" },
  { id: "parent-portal", label: "View Parent Portal ↗", path: "/parent", pageId: "parent-portal" }
];
