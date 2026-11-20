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
  if (aggregate.allowed && version === null) return <CircularProgress aria-label="Loading Reports" />;
  if (aggregate.allowed && version === "existing") return <Navigate to={named.allowed ? "/leader/attendance" : "/leader/attendance?view=trends"} replace />;
  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Reports" />
    {!aggregate.allowed ? <Alert severity="error">You do not have access to these reports.</Alert> :
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        {named.allowed && <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography color="text.secondary">{named.isAdmin ? "All sections" : named.sections.join(", ")}</Typography>
          <Button component={Link} to="/leader/attendance" fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>Attendance Insights</Button>
        </Paper>}
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography color="text.secondary">{aggregate.isAdmin ? "All sections" : aggregate.sections.join(", ")}</Typography>
          <Button component={Link} to="/leader/attendance?view=trends" fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>Attendance trends</Button>
        </Paper>
      </Stack>}
  </Container>;
}
