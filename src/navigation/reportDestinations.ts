import { attendanceReportScope } from "../security/attendanceReportAccess.ts";
import { badgeworkReportAccess } from "../security/badgeworkReportAccess.ts";
import { equipmentReportAccess } from "../security/equipmentReportAccess.ts";
import { eventConsentReportAccess } from "../security/eventConsentReportAccess.ts";
import { groupFinanceReportAccess } from "../security/groupFinanceReportAccess.ts";
import { meetingReportAccess } from "../security/meetingReportAccess.ts";
import { membershipTotalsAccess, namedMembershipAccess } from "../security/membershipTotalsAccess.ts";

const sectionScope = (group: boolean, sections: string[]) => group ? "All sections" : sections.join(", ");

export function reportDestinations(profile: Parameters<typeof attendanceReportScope>[0]) {
  const named = attendanceReportScope(profile, "named");
  const aggregate = attendanceReportScope(profile, "aggregate");
  const badgework = badgeworkReportAccess(profile);
  const meetings = meetingReportAccess(profile);
  const membership = membershipTotalsAccess(profile);
  const memberList = namedMembershipAccess(profile);
  const consent = eventConsentReportAccess(profile);
  const finance = groupFinanceReportAccess(profile).canOpen;
  return [
    { allowed: named.allowed, path: "/leader/attendance", label: "Attendance Insights", scope: sectionScope(named.isAdmin, named.sections) },
    { allowed: aggregate.allowed, path: "/leader/attendance?view=trends", label: "Attendance trends", scope: sectionScope(aggregate.isAdmin, aggregate.sections) },
    { allowed: equipmentReportAccess(profile).canOpen, path: "/leader/qm-reports", label: "Equipment Reports", scope: "All sections" },
    { allowed: badgework.canOpen, path: "/leader/reports/badgework", label: "Badgework Progress", scope: sectionScope(badgework.group, badgework.exportSections) },
    { allowed: meetings.canOpen, path: "/leader/reports/meetings", label: "Meeting Records Report", scope: meetings.group ? "All sections and group meetings" : [...(meetings.groupMinutes ? ["Group meetings"] : []), ...meetings.sections].join(", ") },
    { allowed: membership.canOpen, path: "/leader/reports/membership", label: "Membership Totals", scope: sectionScope(membership.group || membership.chairperson, membership.sections) },
    { allowed: memberList.canOpen, path: "/leader/reports/member-list", label: "Member List Report", scope: sectionScope(memberList.group, memberList.sections) },
    { allowed: consent.canOpen, path: "/leader/reports/youth-consent", label: "Youth Consent Status", scope: sectionScope(consent.group, consent.sections) },
    { allowed: consent.canOpen, path: "/leader/reports/event-consent", label: "Event Consent Status", scope: consent.group ? "Group events" : consent.sections.join(", ") },
    { allowed: finance, path: "/leader/reports/subs", label: "Group Subs Report", scope: "All sections" },
    { allowed: finance, path: "/leader/reports/floats", label: "Group Section Floats Report", scope: "All sections" }
  ].filter(item => item.allowed);
}

export const reportsMenuPath = "/leader/reports/home";

export function isReportDestination(pathname: string, search: string, destinations: ReturnType<typeof reportDestinations>) {
  if (pathname === reportsMenuPath || pathname === "/leader/reports") return true;
  const view = new URLSearchParams(search).get("view");
  return destinations.some(({ path }) => {
    const [route, query] = path.split("?");
    if (route !== pathname) return false;
    const expectedView = new URLSearchParams(query).get("view");
    return expectedView === view || (route === "/leader/attendance" && expectedView === null && view === "matrix");
  });
}

const replacedReportItems = new Set(["attendance-insights", "qm-reports", "treasurer-reports", "reports-exports"]);
export function reportMenuKeepsItem(id: string, reportsEnabled: boolean) {
  return !reportsEnabled || !replacedReportItems.has(id);
}
