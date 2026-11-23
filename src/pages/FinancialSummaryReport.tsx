import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { auth } from "../firebase";
import { canViewFinancialSummary } from "../security/financialSummaryAccess";
import { groupFinanceReportAccess } from "../security/groupFinanceReportAccess";
import { applicationErrorMessage } from "../services/applicationErrors";
import { requestBackend } from "../services/backendRequest";
import { hallBookingEndpoint } from "../services/hallBookingEndpoint";
import { formatEuro } from "../services/subsLogic";

type Summary = {
  period: string;
  collectedCents: number;
  outstandingCents: number;
  floats: { section: string; balanceCents: number }[];
};

async function loadSummary() {
  const endpoint = hallBookingEndpoint({
    appEnv: import.meta.env.VITE_APP_ENV, firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    emailApiUrl: import.meta.env.VITE_EMAIL_API_URL, hallApiUrl: import.meta.env.VITE_HALL_BOOKING_API_URL
  });
  const user = auth.currentUser;
  if (!endpoint || !user) throw new Error("Financial Summary is unavailable.");
  return requestBackend<Summary>(new URL("/financial-summary", endpoint).href, {
    method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: "no-store"
  });
}

export default function FinancialSummaryReport() {
  const { adminProfile, user } = useAdminAuth();
  return <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
    <Box sx={{ "@media print": { display: "none" } }}><LeaderDashboardHeader /></Box>
    <LeaderPageHeader title="Financial Summary" />
    {canViewFinancialSummary(adminProfile) ? <SummaryContent key={user?.uid} canPrint={groupFinanceReportAccess(adminProfile).canExport} /> :
      <Alert severity="error">You do not have access to the Financial Summary.</Alert>}
  </Container>;
}

function SummaryContent({ canPrint }: { canPrint: boolean }) {
  const [data, setData] = useState<Summary>();
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    void loadSummary().then(
      result => { if (current) setData(result); },
      failure => { if (current) setError(applicationErrorMessage(failure, "Unable to load the Financial Summary.", "FinancialSummaryReport")); }
    );
    return () => { current = false; };
  }, []);
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <CircularProgress aria-label="Loading Financial Summary" />;

  return <Stack spacing={2}>
    {canPrint && <Box sx={{ "@media print": { display: "none" } }}>
      <Button variant="outlined" onClick={() => window.print()}>Print / Save PDF</Button>
    </Box>}
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography component="h2" variant="h6">Subs · Scout year {data.period}</Typography>
      <Typography>Collected after reversals · {formatEuro(data.collectedCents)}</Typography>
      <Typography>Outstanding · {formatEuro(data.outstandingCents)}</Typography>
    </Paper>
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography component="h2" variant="h6">Current Section Float balances</Typography>
      {data.floats.length ? data.floats.map(row =>
        <Typography key={row.section}>{row.section} · {formatEuro(row.balanceCents)}</Typography>
      ) : <Typography role="status">No float transactions recorded.</Typography>}
    </Paper>
  </Stack>;
}
