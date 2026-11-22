import { Box, Container } from "@mui/material";
import FinanceReportsPanel from "../components/admin/FinanceReportsPanel";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";

export default function GroupFloatsReport() {
  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <Box sx={{ "@media print": { display: "none" } }}><LeaderDashboardHeader /></Box>
    <LeaderPageHeader title="Group Section Floats Report" />
    <FinanceReportsPanel standalone />
  </Container>;
}
