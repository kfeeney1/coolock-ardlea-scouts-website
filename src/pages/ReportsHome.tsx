import { Alert, Button, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { Link, Navigate } from "react-router-dom";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useExperienceVersion } from "../hooks/useAttendanceExperience";
import { leaderNavigationDestinations } from "../navigation/leaderNavigation";
import { leaderNavigationFilter } from "../navigation/leaderNavigationPermissions";
import { reportDestinations } from "../navigation/reportDestinations";

export default function ReportsHome() {
  const { adminProfile } = useAdminAuth();
  const version = useExperienceVersion("reportsExperience");
  const reports = reportDestinations(adminProfile);
  const first = reports[0];
  if (first && version === null) return <CircularProgress aria-label="Loading Reports" />;
  if (first && version === "existing") return <Navigate to={first.path} replace />;
  const canView = leaderNavigationFilter(adminProfile);
  const legacy = leaderNavigationDestinations.find(item => item.id === "reports-exports" && canView(item));
  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Reports" />
    {!first ? <Alert severity="error">You do not have access to these reports.</Alert> :
      <Stack spacing={2}>
        <Stack sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>
          {reports.map(report => <Paper key={report.path} variant="outlined" sx={{ p: 2 }}>
            <Typography color="text.secondary">{report.scope}</Typography>
            <Button component={Link} to={report.path} fullWidth sx={{ minHeight: 44, justifyContent: "flex-start" }}>{report.label}</Button>
          </Paper>)}
        </Stack>
        {legacy && <Button component={Link} to={legacy.path} variant="outlined" sx={{ alignSelf: "flex-start", minHeight: 44 }}>Legacy Reports &amp; Exports</Button>}
      </Stack>}
  </Container>;
}
