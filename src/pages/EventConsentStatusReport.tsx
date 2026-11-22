import { Alert, CircularProgress, Container, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { eventConsentReportAccess } from "../security/eventConsentReportAccess";
import { applicationErrorMessage } from "../services/applicationErrors";
import { recordedEventConsent } from "../services/eventConsentReport";
import { loadEventReportRecords, loadNamedMembershipRows } from "../services/reporting";
import type { EventReportRecord, MemberReportRow } from "../services/reportingLogic";
import { formatSiteDate } from "../services/siteDateFormat";

export default function EventConsentStatusReport() {
  const { adminProfile, user } = useAdminAuth();
  const access = useMemo(() => eventConsentReportAccess(adminProfile), [adminProfile]);
  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Event Consent Status" />
    {access.canOpen ? <ConsentStatus key={JSON.stringify([user?.uid, access])} access={access} /> :
      <Alert severity="error">You do not have access to this report.</Alert>}
  </Container>;
}

function ConsentStatus({ access }: { access: ReturnType<typeof eventConsentReportAccess> }) {
  const [result, setResult] = useState<{ events: EventReportRecord[]; members: MemberReportRow[] }>();
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    const scope = { isAdmin: access.group, sections: access.sections };
    void Promise.all([loadEventReportRecords(scope), access.group ? [] : loadNamedMembershipRows(scope)]).then(
      ([events, members]) => { if (current) setResult({ events: events.filter(event => event.consentRequired), members }); },
      failure => { if (current) setError(applicationErrorMessage(failure, "Unable to load event consent status.", "EventConsentStatusReport")); }
    );
    return () => { current = false; };
  }, [access]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!result) return <CircularProgress aria-label="Loading event consent status" />;
  const event = result.events.find(row => row.id === selectedId) ?? result.events[0];
  const memberNames = new Map(result.members.map(row => [row.id, row.displayName]));
  const rows = event ? recordedEventConsent(event).filter(row => access.group || memberNames.has(row.id)) : [];
  const received = rows.filter(row => row.received).length;
  const outstanding = rows.filter(row => !row.received);
  return <Stack spacing={2}>
    <Typography>Scope: {access.group ? "Group events you can access" : access.sections.join(", ")}</Typography>
    {!event ? <Typography role="status">No consent-required events in this scope.</Typography> : <>
      <TextField select label="Event" value={event.id} onChange={change => setSelectedId(change.target.value)}>
        {result.events.map(row => <MenuItem key={row.id} value={row.id}>{formatSiteDate(row.startDate)} · {row.title} · {row.section}</MenuItem>)}
      </TextField>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography component="h2" variant="h6">{event.title}</Typography>
        <Typography>{received} received · {outstanding.length} outstanding</Typography>
        {outstanding.length === 0 && <Typography role="status">No outstanding consent in the recorded roster.</Typography>}
        {!access.group && outstanding.length > 0 && <Stack component="ul" sx={{ pl: 3 }}>
          {outstanding.map(row => <Typography component="li" key={row.id}>{memberNames.get(row.id)}</Typography>)}
        </Stack>}
      </Paper>
    </>}
  </Stack>;
}
