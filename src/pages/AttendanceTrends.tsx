import { Alert, Button, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import DateRangeFields from "../components/DateRangeFields";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { applicationErrorMessage } from "../services/applicationErrors";
import { loadEventReportRecords } from "../services/reporting";
import { attendanceTrendCsv, eventOverviewCsv, filterEventsByDateRange, type EventReportRecord } from "../services/reportingLogic";
import { formatSiteDate } from "../services/siteDateFormat";

export default function AttendanceTrends({ scope }: { scope: { isAdmin: boolean; sections: string[] } }) {
  const [events, setEvents] = useState<EventReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let current = true;
    void loadEventReportRecords(scope).then(
      rows => { if (current) { setEvents(rows); setLoading(false); } },
      failure => { if (current) { setError(applicationErrorMessage(failure, "Unable to load attendance trends.", "AttendanceTrends")); setLoading(false); } }
    );
    return () => { current = false; };
  }, [scope]);

  const invalid = Boolean(from && to && from > to);
  const rows = invalid ? [] : filterEventsByDateRange(events, from, to);

  function exportCsv(name: string, csv: string) {
    if (!rows.length) return;
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Attendance trends" />
    <Stack spacing={2}>
      <Typography>Scope: {scope.isAdmin ? "All sections" : scope.sections.join(", ")}</Typography>
      <DateRangeFields startDate={from} endDate={to} startLabel="From" endLabel="To" onStartDateChange={setFrom} onEndDateChange={setTo} />
      {loading ? <CircularProgress aria-label="Loading attendance trends" /> : error ? <Alert severity="error">{error}</Alert> :
        invalid ? <Alert severity="error">The end date must be on or after the start date.</Alert> :
        !rows.length ? <Typography role="status">No events in this date range.</Typography> : <>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ "@media print": { display: "none" } }}>
            <Button variant="outlined" onClick={() => exportCsv("attendance-trends", attendanceTrendCsv(rows))}>Export Attendance Trends</Button>
            <Button variant="outlined" onClick={() => exportCsv("event-overview", eventOverviewCsv(rows))}>Export Event Overview</Button>
            <Button variant="outlined" onClick={() => window.print()}>Print / Save PDF</Button>
          </Stack>
          {rows.map(event => <Paper key={event.id} variant="outlined" sx={{ p: 2 }}>
            <Typography component="h2" variant="h6">{event.title}</Typography>
            <Typography>{formatSiteDate(event.startDate)} · {event.section}</Typography>
            <Typography>Attended: {Object.values(event.attendance).filter(status => status === "attending").length}</Typography>
          </Paper>)}
        </>}
    </Stack>
  </Container>;
}
