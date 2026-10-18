// Reviewed against the canonical permission registry. These are independent UI
// expectations, not values calculated by the application's navigation filter.
// Ordinary Leaders retain shared capabilities even with a single appointment.
const common = {
  programme: ["weekly-meetings", "events-activities", "group-polls", "badgework", "programme-equipment"],
  "people-parents": ["member-management", "consent-management", "event-consent", "parent-communications", "family-billing"],
  "group-operations": ["group-equipment-stores", "group-section-floats", "group-subs", "group-meeting-records"],
  "insights-records": ["attendance-insights", "reports-exports"],
  administration: ["roles-permissions"]
};
const secretary = ["secretary-meeting-records"];
const quartermaster = ["qm-equipment-stores", "qm-detailed-inventory", "qm-equipment-issues", "qm-reports", "qm-settings"];
export const personaAccountDestinations = ["my-profile", "info-faq", "parent-portal"];
export type NavigationPersona = { name: string; email: string; groups: Record<string, string[]>; primary: string };
export const navigationPersonas: NavigationPersona[] = [
  { name: "Programme appointment", email: "test.scout.programme.scouter@example.com", groups: common, primary: "weekly-meetings" },
  { name: "Secretary appointment", email: "test.group.secretary@example.com", groups: { ...common, secretary, "insights-records": [...common["insights-records"], "activity-log"] }, primary: "secretary-meeting-records" },
  { name: "Bosun appointment", email: "test.group.quartermaster@example.com", groups: { ...common, quartermaster }, primary: "qm-reports" },
  { name: "People and Parents", email: "test.group.leader@example.com", groups: { ...common, "people-parents": [...common["people-parents"], "join-management"], "insights-records": [...common["insights-records"], "activity-log"], administration: ["roles-permissions", "leader-access", "settings"] }, primary: "member-management" },
  { name: "Group Operations", email: "test.group.chairperson@example.com", groups: { ...common, secretary }, primary: "group-meeting-records" },
  { name: "Secretary and Bosun with inactive Treasurer", email: "test.navigation.multi.appointment@example.com", groups: { ...common, secretary, quartermaster, "insights-records": [...common["insights-records"], "activity-log"] }, primary: "qm-reports" },
  { name: "Superuser", email: "superadmin@example.com", groups: { ...common, "people-parents": [...common["people-parents"], "join-management"], secretary, quartermaster, treasurer: ["treasurer-subs", "treasurer-floats", "treasurer-reports", "treasurer-settings"], "insights-records": [...common["insights-records"], "activity-log"], administration: ["roles-permissions", "leader-requests", "parent-access", "leader-access", "settings", "system-information"] }, primary: "system-information" }
];

export const categoryRouteSamples: Record<string, string> = {
  programme: "weekly-meetings", "people-parents": "member-management", secretary: "secretary-meeting-records",
  quartermaster: "qm-reports", "group-operations": "group-meeting-records", "insights-records": "attendance-insights",
  administration: "roles-permissions", treasurer: "treasurer-reports", "super-admin": "system-information"
};
