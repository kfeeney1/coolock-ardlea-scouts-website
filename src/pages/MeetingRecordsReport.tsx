import { Alert, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { meetingReportAccess } from "../security/meetingReportAccess";
import { applicationErrorMessage } from "../services/applicationErrors";
import { loadMeetingRecords, type MeetingRecord } from "../services/meetingRecords";
import { formatSiteDate } from "../services/siteDateFormat";

export default function MeetingRecordsReport() {
  const { adminProfile, user } = useAdminAuth();
  const access = useMemo(() => meetingReportAccess(adminProfile), [adminProfile]);
  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Meeting Records Report" />
    {access.canOpen ? <MeetingMinutes key={JSON.stringify([user?.uid, access])} access={access} /> :
      <Alert severity="error">You do not have access to this report.</Alert>}
  </Container>;
}

function MeetingMinutes({ access }: { access: ReturnType<typeof meetingReportAccess> }) {
  const [records, setRecords] = useState<MeetingRecord[]>();
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    void loadMeetingRecords(access.sections, access.group).then(
      rows => { if (current) setRecords(rows); },
      failure => { if (current) setError(applicationErrorMessage(failure, "Unable to load meeting minutes.", "MeetingRecordsReport")); }
    );
    return () => { current = false; };
  }, [access]);
  return <Stack spacing={2}>
    <Typography>Scope: {access.group ? "All sections and group meetings" : access.sections.join(", ")}</Typography>
    {error ? <Alert severity="error">{error}</Alert> : !records ? <CircularProgress aria-label="Loading meeting records" /> :
      !records.length ? <Typography role="status">No meeting records in this scope.</Typography> :
      records.map(record => <Paper component="article" key={record.id} variant="outlined" sx={{ p: 2, overflowWrap: "anywhere" }}>
        <Typography component="h2" variant="h6">{record.title}</Typography>
        <Typography color="text.secondary">{formatSiteDate(record.meetingDate)} · {record.section || "Group"}</Typography>
        {record.attendees.length > 0 && <Typography>Attendees: {record.attendees.join(", ")}</Typography>}
        {([["Minutes", record.notes], ["Decisions", record.decisions], ["Actions", record.actions]] as const).map(([label, value]) =>
          value && <Stack key={label} sx={{ mt: 1 }}>
            <Typography component="h3" variant="subtitle2">{label}</Typography>
            <Typography sx={{ whiteSpace: "pre-wrap" }}>{value}</Typography>
          </Stack>)}
      </Paper>)}
  </Stack>;
}
