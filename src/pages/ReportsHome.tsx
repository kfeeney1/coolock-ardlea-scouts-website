import { groupSubsReportAccess } from "../security/groupSubsReportAccess";
import { eventConsentReportAccess } from "../security/eventConsentReportAccess";
import { membershipTotalsAccess, namedMembershipAccess } from "../security/membershipTotalsAccess";
import { meetingReportAccess } from "../security/meetingReportAccess";
import { badgeworkReportAccess } from "../security/badgeworkReportAccess";
import { equipmentReportAccess } from "../security/equipmentReportAccess";
import { Alert, Button, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { Link, Navigate } from "react-router-dom";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useExperienceVersion } from "../hooks/useAttendanceExperience";
import { attendanceReportScope } from "../security/attendanceReportAccess";

export default function ReportsHome() {
  const { adminProfile } = useAdminAuth();
  const version = useExperienceVersion("reportsExperience");
  const named = attendanceReportScope(adminProfile, "named");
  const aggregate = attendanceReportScope(adminProfile, "aggregate");
  const equipment = equipmentReportAccess(adminProfile).canOpen;
  const badgework = badgeworkReportAccess(adminProfile);
  const meetings = meetingReportAccess(adminProfile);
  const membership = membershipTotalsAccess(adminProfile);
  const memberList = namedMembershipAccess(adminProfile);
  const consent = eventConsentReportAccess(adminProfile);
  const subs = groupSubsReportAccess(adminProfile);
  const hasReports = aggregate.allowed || equipment || badgework.canOpen || meetings.canOpen || membership.canOpen || subs.canOpen;
  if (hasReports && version === null) return <CircularProgress aria-label="Loading Reports" />;
  if (hasReports && version === "existing") {
    const legacyPath = named.allowed ? "/leader/attendance" : aggregate.allowed ? "/leader/attendance?view=trends" : equipment ? "/leader/qm-reports" : badgework.canOpen ? "/leader/reports/badgework" : meetings.canOpen ? "/leader/reports/meetings" : membership.canOpen ? "/leader/reports/membership" : "/leader/reports/subs";
    return <Navigate to={legacyPath} replace />;
  }
  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Reports" />
    {!hasReports ? <Alert severity="error">You do not have access to these reports.</Alert> :
      <Stack sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>
        {named.allowed && <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography color="text.secondary">{named.isAdmin ? "All sections" : named.sections.join(", ")}</Typography>
          <Button component={Link} to="/leader/attendance" fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>Attendance Insights</Button>
        </Paper>}
        {aggregate.allowed && <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography color="text.secondary">{aggregate.isAdmin ? "All sections" : aggregate.sections.join(", ")}</Typography>
          <Button component={Link} to="/leader/attendance?view=trends" fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>Attendance trends</Button>
        </Paper>}
        {equipment && <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography color="text.secondary">All sections</Typography>
          <Button component={Link} to="/leader/qm-reports" fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>Equipment Reports</Button>
        </Paper>}
        {badgework.canOpen && <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography color="text.secondary">{badgework.group ? "All sections" : badgework.exportSections.join(", ")}</Typography>
          <Button component={Link} to="/leader/reports/badgework" fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>Badgework Progress</Button>
        </Paper>}
        {meetings.canOpen && <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography color="text.secondary">{meetings.group ? "All sections and group meetings" : meetings.sections.join(", ")}</Typography>
          <Button component={Link} to="/leader/reports/meetings" fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>Meeting Records Report</Button>
        </Paper>}
        {membership.canOpen && <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography color="text.secondary">{membership.group ? "All sections" : membership.sections.join(", ")}</Typography>
          <Button component={Link} to="/leader/reports/membership" fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>Membership Totals</Button>
        </Paper>}
        {memberList.canOpen && <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography color="text.secondary">{memberList.group ? "All sections" : memberList.sections.join(", ")}</Typography>
          <Button component={Link} to="/leader/reports/member-list" fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>Member List Report</Button>
        </Paper>}
        {consent.canOpen && <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography color="text.secondary">{consent.group ? "Group events" : consent.sections.join(", ")}</Typography>
          <Button component={Link} to="/leader/reports/event-consent" fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>Event Consent Status</Button>
        </Paper>}
        {subs.canOpen && <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography color="text.secondary">All sections</Typography>
          <Button component={Link} to="/leader/reports/subs" fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>Group Subs Report</Button>
        </Paper>}
      </Stack>}
  </Container>;
}
