import { Alert, CircularProgress, Container } from "@mui/material";
import { useEffect, useState } from "react";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import SubsBalancesReport from "../components/admin/SubsBalancesReport";
import { groupSubsReportAccess } from "../security/groupSubsReportAccess";
import { applicationErrorMessage } from "../services/applicationErrors";
import { loadSubsAssignments, loadSubsPayments, loadSubsPolicies } from "../services/subsLedger";
import { resolveCurrentSubsPolicy, type SubsAssignment, type SubsPayment, type SubsRatePolicy } from "../services/subsLogic";

export default function GroupSubsReport() {
  const { adminProfile, user } = useAdminAuth();
  const access = groupSubsReportAccess(adminProfile);
  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Group Subs Report" />
    {access.canOpen ? <SubsReportContent key={user?.uid} canExport={access.canExport} /> :
      <Alert severity="error">You do not have access to this report.</Alert>}
  </Container>;
}

function SubsReportContent({ canExport }: { canExport: boolean }) {
  const [data, setData] = useState<{ assignments: SubsAssignment[]; payments: SubsPayment[]; policies: SubsRatePolicy[] }>();
  const [period, setPeriod] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    void Promise.all([loadSubsAssignments(), loadSubsPayments(), loadSubsPolicies()]).then(
      ([assignments, payments, policies]) => {
        if (!current) return;
        setPeriod(resolveCurrentSubsPolicy(policies)?.period ?? "");
        setData({ assignments, payments, policies });
      },
      failure => { if (current) setError(applicationErrorMessage(failure, "Unable to load the group Subs report.", "GroupSubsReport")); }
    );
    return () => { current = false; };
  }, []);
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <CircularProgress aria-label="Loading group Subs report" />;
  return <SubsBalancesReport {...data} period={period} setPeriod={setPeriod} section="all" canGroupReport canExport={canExport} />;
}
