import { Alert, Button, Container, Paper, Stack, Typography } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import { useMaintenanceAccess } from "../hooks/useMaintenanceAccess";

export default function Maintenance() {
  const access = useMaintenanceAccess();
  const { user, authorised } = useAdminAuth();
  const { pathname } = useLocation();
  if (access.loading) return <Container sx={{ py: 4 }}><Typography role="status">Loading Maintenance…</Typography></Container>;
  if (!access.allowed) return <Container sx={{ py: 4 }}><Alert severity={access.error ? "error" : "info"}>{access.error || (!user ? "Sign in to access Maintenance." : access.enabled === false ? "Maintenance is currently disabled." : "Maintenance is restricted to approved group members.")}</Alert>{!user && <Button component={Link} to="/parent" sx={{ minHeight: 44 }}>Sign in</Button>}</Container>;
  return <Container maxWidth="xl" sx={{ py: 4, overflowWrap: "anywhere" }}>
    {authorised && <LeaderDashboardHeader />}
    <Stack spacing={3}>
      <Button component={Link} to={authorised ? "/leader" : "/parent"} sx={{ alignSelf: "flex-start", minHeight: 44 }}>Back to {authorised ? "Dashboard" : "Parent Portal"}</Button>
      <Typography variant="h3" component="h1" color="secondary" sx={{ fontWeight: 800 }}>Maintenance</Typography>
      <Typography>Care for our Scout den, facilities and shared spaces.</Typography>
      <Stack component="nav" aria-label="Maintenance" direction={{ xs: "column", sm: "row" }} spacing={2}>
        {([['Tasks', '/maintenance/tasks'], ['Documents', '/maintenance/documents']] as const).map(([label, path]) => <Button key={path} component={Link} to={path} aria-current={pathname === path ? "page" : undefined} variant={pathname === path ? "contained" : "outlined"} sx={{ minHeight: 48 }}>{label}</Button>)}
      </Stack>
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, borderTop: "6px solid", borderTopColor: "secondary.main" }}>
        <Typography component="h2" variant="h5">{pathname.endsWith("documents") ? "Documents" : "Tasks"}</Typography>
        <Typography sx={{ mt: 2 }}>This workflow is being prepared. Maintenance remains disabled until acceptance is complete.</Typography>
      </Paper>
    </Stack>
  </Container>;
}
