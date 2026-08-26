import { Box, Container } from "@mui/material";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import OrganisationChartContent from "../components/admin/OrganisationChartContent";

export default function OrganisationChart() {
  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="xl">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Organisational Chart" description="Internal organisational hierarchy, sections and reporting relationships for active leaders." />
      <OrganisationChartContent />
    </Container>
  </Box>;
}
