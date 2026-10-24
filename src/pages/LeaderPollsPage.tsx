import { Box, Container, Typography } from "@mui/material";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPollsPanel from "../components/admin/LeaderPollsPanel";

export default function LeaderPollsPage() {
  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 2, md: 6 } }}>
    <Container maxWidth="xl">
      <LeaderDashboardHeader />
      <Typography component="h1" variant="h4" color="secondary" sx={{ fontWeight: 800, mb: 2 }}>Group Polls</Typography>
      <LeaderPollsPanel showTitle={false} management />
    </Container>
  </Box>;
}
