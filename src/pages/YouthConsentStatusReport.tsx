import { Alert, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { auth } from "../firebase";
import { eventConsentReportAccess } from "../security/eventConsentReportAccess";
import { requestBackend } from "../services/backendRequest";
import { hallBookingEndpoint } from "../services/hallBookingEndpoint";
import { formatSiteDate } from "../services/siteDateFormat";

const statusLabels = { current: "Current", missing: "Missing", expired: "Expired", "renewal-required": "Renewal required" };
type Status = keyof typeof statusLabels;
type Report = { totals: Record<Status, number>; rows: { id: string; name: string; section: string; status: Status; validUntil: string | null }[] };

async function loadReport(): Promise<Report> {
  const endpoint = hallBookingEndpoint({
    appEnv: import.meta.env.VITE_APP_ENV, firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    emailApiUrl: import.meta.env.VITE_EMAIL_API_URL, hallApiUrl: import.meta.env.VITE_HALL_BOOKING_API_URL
  });
  const user = auth.currentUser;
  if (!endpoint || !user) throw new Error("Report service is unavailable.");
  return requestBackend(new URL("/youth-consent-status", endpoint).href, {
    method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: "no-store"
  });
}

export default function YouthConsentStatusReport() {
  const { adminProfile, user } = useAdminAuth();
  const access = eventConsentReportAccess(adminProfile);
  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Youth Consent Status" />
    {access.canOpen
      ? <YouthConsentResults key={JSON.stringify([user?.uid, access])} group={access.group} />
      : <Alert severity="error">You do not have access to this report.</Alert>}
  </Container>;
}

function YouthConsentResults({ group }: { group: boolean }) {
  const [report, setReport] = useState<Report>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    void loadReport().then(
      result => { if (current) setReport(result); },
      () => { if (current) setFailed(true); }
    );
    return () => { current = false; };
  }, []);

  if (failed) return <Alert severity="error">Unable to load youth consent status.</Alert>;
  if (!report) return <CircularProgress aria-label="Loading youth consent status" />;
  if (Object.values(report.totals).every(total => total === 0)) return <Typography role="status">No active youth members in this scope.</Typography>;

  return <Stack spacing={2}>
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography component="h2" variant="h6">{group ? "Group totals" : "Assigned section totals"}</Typography>
      {(Object.keys(statusLabels) as Status[]).map(status =>
        <Typography key={status}>{statusLabels[status]} · {report.totals[status]}</Typography>)}
    </Paper>
    {report.rows.length > 0 && <Stack component="ul" spacing={1} sx={{ m: 0, p: 0, listStyle: "none" }}>
      {report.rows.map(row => <Paper key={row.id} component="li" variant="outlined" sx={{ p: 2 }}>
        <Typography sx={{ fontWeight: 700 }}>{row.name}</Typography>
        <Typography>{row.section} · {statusLabels[row.status]}</Typography>
        {row.validUntil && <Typography variant="body2">Valid until {formatSiteDate(row.validUntil)}</Typography>}
      </Paper>)}
    </Stack>}
  </Stack>;
}
