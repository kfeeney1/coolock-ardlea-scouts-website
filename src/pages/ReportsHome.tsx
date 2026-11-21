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
  const hasReports = aggregate.allowed || equipment;
  if (hasReports && version === null) return <CircularProgress aria-label="Loading Reports" />;
  if (hasReports && version === "existing") {
    const legacyPath = named.allowed ? "/leader/attendance" : aggregate.allowed ? "/leader/attendance?view=trends" : "/leader/qm-reports";
    return <Navigate to={legacyPath} replace />;
  }
  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Reports" />
    {!hasReports ? <Alert severity="error">You do not have access to these reports.</Alert> :
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        {named.allowed && <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography color="text.secondary">{named.isAdmin ? "All sections" : named.sections.join(", ")}</Typography>
          <Button component={Link} to="/leader/attendance" fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>Attendance Insights</Button>
        </Paper>}
        {aggregate.allowed && <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography color="text.secondary">{aggregate.isAdmin ? "All sections" : aggregate.sections.join(", ")}</Typography>
          <Button component={Link} to="/leader/attendance?view=trends" fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>Attendance trends</Button>
        </Paper>}
        {equipment && <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography color="text.secondary">All sections</Typography>
          <Button component={Link} to="/leader/qm-reports" fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>Equipment Reports</Button>
        </Paper>}
      </Stack>}
  </Container>;
}
