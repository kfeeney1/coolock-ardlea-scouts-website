import { useSearchParams } from "react-router-dom";
import { Box, Container } from "@mui/material";
import FinanceReportsPanel from "../components/admin/FinanceReportsPanel";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";

export default function GroupFloatsReport() {
  const [params] = useSearchParams();
  const sectionView = params.get("view") === "section";
  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <Box sx={{ "@media print": { display: "none" } }}><LeaderDashboardHeader /></Box>
    <LeaderPageHeader title={sectionView ? "Section Floats Report" : "Group Section Floats Report"} />
    <FinanceReportsPanel scope={sectionView ? "section" : "group"} />
  </Container>;
}
