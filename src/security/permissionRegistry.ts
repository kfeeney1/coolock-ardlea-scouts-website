import { isGroupLeadershipAppointment } from "./scoutingAppointments.ts";

export type PermissionScope = "own" | "linked-members" | "assigned-section" | "group-wide" | "system";
export type PermissionArea =
  | "Members"
  | "Parents & Guardians"
  | "Meetings & Attendance"
  | "Events & Programme"
  | "Badgework"
  | "Consent & Medical"
  | "Finance & Subs"
  | "Equipment"
  | "Reports"
  | "Audit"
  | "Account Approval"
  | "Role Management"
  | "Settings"
  | "System Administration";

export type PermissionGrant =
  | "parent"
  | "leader"
  | "admin"
  | "super-admin"
  | "Group Leader"
  | "Group Secretary"
  | "Group Treasurer"
  | "Group Quartermaster / Bo'sun";

export type PermissionDefinition = {
  id: string;
  name: string;
  description: string;
  area: PermissionArea;
  scope: PermissionScope;
  grantedBy: PermissionGrant[];
  enforcement: string[];
  protected: boolean;
};

export const SYSTEM_ACCESS_ROLES = ["Parent / Guardian", "Leader", "Admin", "Super Admin"] as const;

export const CURRENT_SCOUTING_APPOINTMENTS = [
  "Group Leader",
  "Deputy Group Leader",
  "Group Secretary",
  "Group Treasurer",
  "Group Quartermaster / Bo'sun",
  "Group Chairperson",
  "Group Youth Champion",
  "Section Leader",
  "Assistant Section Leader",
  "Programme Scouter",
  "Scouter"
] as const;

export const PERMISSION_REGISTRY: PermissionDefinition[] = [
  { id: "members.read.linked", name: "View linked children", description: "View approved member records linked to the signed-in parent account.", area: "Members", scope: "linked-members", grantedBy: ["parent"], enforcement: ["Firestore members rules", "parentAccounts linkage"], protected: true },
  { id: "members.read.section", name: "View section members", description: "View member records in assigned sections.", area: "Members", scope: "assigned-section", grantedBy: ["leader", "admin", "super-admin"], enforcement: ["Firestore members rules", "leader section profile"], protected: true },
  { id: "members.read.group", name: "View members group-wide", description: "View member records across all sections without becoming a system administrator.", area: "Members", scope: "group-wide", grantedBy: ["Group Leader", "Group Secretary", "Group Treasurer"], enforcement: ["Firestore members rules", "organisationLeadership appointment"], protected: true },
  { id: "members.write.section", name: "Manage section members", description: "Create and update member records inside assigned sections.", area: "Members", scope: "assigned-section", grantedBy: ["leader", "admin", "super-admin"], enforcement: ["Firestore members rules"], protected: true },
  { id: "parents.manage", name: "Manage parent access", description: "Review parent accounts and maintain approved member/section links.", area: "Parents & Guardians", scope: "system", grantedBy: ["admin", "super-admin"], enforcement: ["Firestore parentAccounts rules", "route/UI guard"], protected: true },
  { id: "meetings.manage.section", name: "Manage section meetings", description: "Manage weekly and leader-meeting records for assigned sections under the same section-scoped Rules used for ordinary leaders.", area: "Meetings & Attendance", scope: "assigned-section", grantedBy: ["leader", "admin", "super-admin"], enforcement: ["Firestore weeklyMeetings/meetingRecords rules"], protected: true },
  { id: "weekly-meetings.manage.group", name: "Manage weekly meetings group-wide", description: "Create and update weekly meeting records and their parent-facing programme projections across sections.", area: "Meetings & Attendance", scope: "group-wide", grantedBy: ["Group Leader"], enforcement: ["Firestore weeklyMeetings/parentWeeklyMeetings rules"], protected: true },
  { id: "meeting-records.read.group", name: "Read meeting records group-wide", description: "Read protected weekly and meeting records across sections. Group meeting creation remains Admin-only.", area: "Meetings & Attendance", scope: "group-wide", grantedBy: ["Group Leader", "Group Secretary"], enforcement: ["Firestore weeklyMeetings/meetingRecords rules"], protected: true },
  { id: "events.manage.section", name: "Manage section events", description: "Create and update events for assigned sections.", area: "Events & Programme", scope: "assigned-section", grantedBy: ["leader", "admin", "super-admin"], enforcement: ["Firestore events/publicEvents rules"], protected: true },
  { id: "event-gallery.manage.section", name: "Manage section event galleries", description: "Upload and manage event-gallery media for assigned sections, subject to Storage metadata and consent boundaries.", area: "Events & Programme", scope: "assigned-section", grantedBy: ["leader", "admin", "super-admin"], enforcement: ["Firebase Storage event-gallery rules", "Firestore event gallery access projection"], protected: true },
  { id: "event-gallery.manage.group", name: "Manage event galleries group-wide", description: "Upload and manage event-gallery media across sections without changing event-record access itself.", area: "Events & Programme", scope: "group-wide", grantedBy: ["Group Leader"], enforcement: ["Firebase Storage event-gallery rules"], protected: true },
  { id: "programme.manage.section", name: "Manage programme", description: "Use programme-library records for assigned sections.", area: "Events & Programme", scope: "assigned-section", grantedBy: ["leader", "admin", "super-admin"], enforcement: ["Firestore programmeLibrary rules"], protected: true },
  { id: "programme.manage.group", name: "Manage programme group-wide", description: "Read, create, update and remove programme-library records across sections.", area: "Events & Programme", scope: "group-wide", grantedBy: ["Group Leader"], enforcement: ["Firestore programmeLibrary rules"], protected: true },
  { id: "badgework.read.linked", name: "View linked badgework", description: "View Adventure Skills progress for approved linked children.", area: "Badgework", scope: "linked-members", grantedBy: ["parent"], enforcement: ["Firestore memberAdventureSkillProgress rules"], protected: true },
  { id: "badgework.manage.section", name: "Manage section badgework", description: "Record and remove Adventure Skills progress for assigned-section members.", area: "Badgework", scope: "assigned-section", grantedBy: ["leader", "admin", "super-admin"], enforcement: ["Firestore memberAdventureSkillProgress rules"], protected: true },
  { id: "badgework.manage.group", name: "Manage badgework group-wide", description: "Record Adventure Skills progress across sections.", area: "Badgework", scope: "group-wide", grantedBy: ["Group Leader"], enforcement: ["Firestore memberAdventureSkillProgress rules"], protected: true },
  { id: "badgework.read.group", name: "Read badgework group-wide", description: "Read Adventure Skills progress across sections.", area: "Badgework", scope: "group-wide", grantedBy: ["Group Secretary"], enforcement: ["Firestore memberAdventureSkillProgress rules"], protected: true },
  { id: "consent.manage.section", name: "Manage section consent records", description: "Access consent and medical records only where the section and workflow authorise it.", area: "Consent & Medical", scope: "assigned-section", grantedBy: ["leader", "admin", "super-admin"], enforcement: ["Firestore consentApplications/event consent rules"], protected: true },
  { id: "finance.manage.section", name: "Manage section finance", description: "View and record authorised finance data for assigned sections.", area: "Finance & Subs", scope: "assigned-section", grantedBy: ["leader", "admin", "super-admin"], enforcement: ["Firestore finance rules", "Storage finance receipt rules"], protected: true },
  { id: "finance.manage.group", name: "Manage finance group-wide", description: "View and record authorised finance and subs data across all sections.", area: "Finance & Subs", scope: "group-wide", grantedBy: ["Group Leader", "Group Treasurer", "admin", "super-admin"], enforcement: ["Firestore finance/subs rules", "Storage finance receipt rules"], protected: true },
  { id: "subs.policy.manage", name: "Manage subs policy", description: "Manage approved Scout-year subs rate policies and classifications.", area: "Finance & Subs", scope: "group-wide", grantedBy: ["Group Leader", "Group Treasurer", "admin", "super-admin"], enforcement: ["Firestore subsRatePolicies/subsAssignments rules"], protected: true },
  { id: "equipment.read.group", name: "View equipment group-wide", description: "View the group equipment register, locations, categories and equipment history.", area: "Equipment", scope: "group-wide", grantedBy: ["leader", "admin", "super-admin"], enforcement: ["Firestore equipment read rules"], protected: true },
  { id: "equipment.loan.section", name: "Manage section equipment loans", description: "Check equipment out and return it for assigned sections within the equipment rules.", area: "Equipment", scope: "assigned-section", grantedBy: ["leader", "admin", "super-admin"], enforcement: ["Firestore equipmentLoans/equipmentHistory rules"], protected: true },
  { id: "equipment.manage", name: "Manage equipment", description: "Manage equipment, stores, locations, categories and authorised incidents.", area: "Equipment", scope: "group-wide", grantedBy: ["Group Leader", "Group Quartermaster / Bo'sun", "admin", "super-admin"], enforcement: ["Firestore equipment rules"], protected: true },
  { id: "reports.section", name: "Run section reports", description: "View/export reporting data limited to authorised sections.", area: "Reports", scope: "assigned-section", grantedBy: ["leader", "admin", "super-admin"], enforcement: ["Underlying Firestore collection rules", "report scope logic"], protected: true },
  { id: "audit.read", name: "View activity log", description: "View protected activity/audit history.", area: "Audit", scope: "group-wide", grantedBy: ["Group Leader", "Group Secretary", "admin", "super-admin"], enforcement: ["Firestore auditLog rules", "navigation/UI guard"], protected: true },
  { id: "accounts.approve.leader", name: "Approve leader accounts", description: "Review leader registration requests and approve ordinary leader access.", area: "Account Approval", scope: "system", grantedBy: ["admin", "super-admin"], enforcement: ["Firestore leaderRegistrationRequests/adminUsers rules"], protected: true },
  { id: "roles.delegate.operational", name: "Delegate ordinary leader assignments", description: "Assign ordinary operational Scouting appointments and section scope to other Leader accounts without changing activation or system access roles.", area: "Role Management", scope: "group-wide", grantedBy: ["Group Leader"], enforcement: ["Firestore adminUsers/organisationLeadership/publicLeadership rules", "Leader Access UI", "transactional mutation service"], protected: true },
  { id: "roles.manage.operational", name: "Manage ordinary leader access", description: "Maintain ordinary leader activation, assigned sections and organisation records within server-enforced limits.", area: "Role Management", scope: "system", grantedBy: ["admin", "super-admin"], enforcement: ["Firestore adminUsers/organisationLeadership rules", "Leader Access UI"], protected: true },
  { id: "roles.manage.admin", name: "Promote or demote Admin", description: "Promote or demote non-Super-Admin accounts between Leader and Admin.", area: "Role Management", scope: "system", grantedBy: ["super-admin"], enforcement: ["Firestore adminUsers rules", "Leader Access UI"], protected: true },
  { id: "settings.session.manage", name: "Manage session settings", description: "Manage protected system session/security settings.", area: "Settings", scope: "system", grantedBy: ["admin", "super-admin"], enforcement: ["Firestore siteSettings rules", "route/UI guard"], protected: true },
  { id: "settings.subs.manage", name: "Manage subs settings", description: "Manage the finance-specific subs configuration exposed in Settings.", area: "Settings", scope: "group-wide", grantedBy: ["Group Leader", "Group Treasurer", "admin", "super-admin"], enforcement: ["Firestore subs policy rules", "settings section guard"], protected: true },
  { id: "system.superadmin.protect", name: "Protect Super Admin accounts", description: "No ordinary role or appointment may grant Super Admin or alter a protected Super Admin account.", area: "System Administration", scope: "system", grantedBy: ["super-admin"], enforcement: ["Firestore adminUsers rules"], protected: true }
];

const grantMatches = (grant: PermissionGrant, role: string, scoutingRole: string) => {
  if (grant === role) return true;
  if (grant === "admin" && role === "super-admin") return true;
  if (grant === "leader" && ["leader", "admin", "super-admin"].includes(role)) return true;
  if (grant === "Group Leader" && isGroupLeadershipAppointment(scoutingRole)) return true;
  return grant === scoutingRole;
};

export function effectivePermissionsFor(role: string, scoutingRole: string): PermissionDefinition[] {
  return PERMISSION_REGISTRY.filter((permission) => permission.grantedBy.some((grant) => grantMatches(grant, role, scoutingRole)));
}
