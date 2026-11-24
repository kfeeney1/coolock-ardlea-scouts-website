import { Alert, Button, Container, MenuItem, Stack, TextField } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { eventRosterExportAccess } from "../security/eventRosterExportAccess";
import { applicationErrorMessage } from "../services/applicationErrors";
import { recordAuditEvent } from "../services/auditLog";
import { downloadCsv } from "../services/downloadCsv";
import type { AttendanceStatus, EventConsentStatus } from "../services/eventAdmin";
import { attendanceLabel, consentLabel, eventRosterFilename } from "../services/eventManagementLogic";
import { loadEventRosterReport } from "../services/eventRosterReport";
import { loadEventReportRecords } from "../services/reporting";
import { csvCell } from "../services/reportingLogic";
import { formatSiteDate } from "../services/siteDateFormat";

type Choice = { id: string; title: string; section: string; startDate: string };
type Roster = { title: string; startDate: string; rows: {
  name: string; section: string; attendance: AttendanceStatus; consent: EventConsentStatus;
}[] };
const headings = ["Member", "Section", "Attendance", "Consent status"];

function showPrintView(popup: Window, title: string, rows: string[][]) {
  const document = popup.document;
  document.title = title;
  const heading = document.createElement("h1");
  heading.textContent = title;
  const print = document.createElement("button");
  print.textContent = "Print / Save PDF";
  print.onclick = () => popup.print();
  const table = document.createElement("table");
  const head = table.createTHead().insertRow();
  for (const text of headings) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = text;
    head.append(cell);
  }
  const body = table.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    for (const value of values) row.insertCell().textContent = value;
  }
  const styles = document.createElement("style");
  styles.textContent = "body{font:16px Arial,sans-serif;margin:24px}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{padding:8px;border:1px solid #888;text-align:left}@media print{button{display:none}tr{break-inside:avoid}}";
  document.head.append(styles);
  document.body.replaceChildren(heading, print, table);
  popup.focus();
}

export default function EventRosterReport() {
  const { adminProfile, user } = useAdminAuth();
  const access = useMemo(() => eventRosterExportAccess(adminProfile), [adminProfile]);
  const [params] = useSearchParams();
  const eventId = params.get("event") ?? "";
  return <Container maxWidth="md" sx={{ py: 3 }}>
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Event Roster Exports" />
    {access.allowed ? <RosterActions key={JSON.stringify([user?.uid, access, eventId])} access={access} eventId={eventId} /> :
      <Alert severity="error">You do not have access to this report.</Alert>}
  </Container>;
}

function RosterActions({ access, eventId }: { access: ReturnType<typeof eventRosterExportAccess>; eventId: string }) {
  const [events, setEvents] = useState<Choice[]>([]);
  const [selectedId, setSelectedId] = useState(eventId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(Boolean(eventId));
  useEffect(() => {
    if (eventId) return;
    let current = true;
    const choices = access.group ? loadEventRosterReport<{ events: Choice[] }>(null).then(result => result.events)
      : loadEventReportRecords({ isAdmin: false, sections: access.sections });
    void choices.then(rows => {
      if (!current) return;
      setEvents(rows);
      setSelectedId(rows[0]?.id ?? "");
      setLoaded(true);
    }, failure => {
      if (current) setError(applicationErrorMessage(failure, "Unable to load events.", "EventRosterReport"));
    });
    return () => { current = false; };
  }, [access, eventId]);

  async function output(format: "CSV" | "print") {
    setError("");
    const popup = format === "print" ? window.open("", "_blank", "width=1000,height=800") : null;
    if (format === "print" && !popup) {
      setError("Allow pop-ups for this site to open the print view.");
      return;
    }
    if (popup) popup.opener = null;
    setBusy(true);
    try {
      const roster = await loadEventRosterReport<Roster>(selectedId);
      const rows = roster.rows.map(row => [row.name, row.section, attendanceLabel(row.attendance), consentLabel(row.consent)]);
      if (popup) {
        if (popup.closed) return;
        showPrintView(popup, `${roster.title} · ${formatSiteDate(roster.startDate)}`, rows);
      } else {
        const csv = [["Event", "Date", ...headings], ...rows.map(row => [roster.title, roster.startDate, ...row])]
          .map(row => row.map(csvCell).join(",")).join("\r\n");
        downloadCsv(eventRosterFilename(roster.title), csv);
      }
      void recordAuditEvent({ category: "event-consent", action: "Event roster output opened", targetId: selectedId,
        targetLabel: "Event roster", description: `Opened ${format} output for ${rows.length} roster rows.`,
        section: access.group ? "All sections" : access.sections.join(", ") });
    } catch (failure) {
      popup?.close();
      setError(applicationErrorMessage(failure, "Unable to open the event roster output.", "EventRosterReport"));
    } finally {
      setBusy(false);
    }
  }

  return <Stack spacing={2}>
    {error && <Alert severity="error">{error}</Alert>}
    {eventId && <Button component={Link} to="/leader/reports/event-roster">Choose another event</Button>}
    {!eventId && events.length > 0 && <TextField select label="Event" value={selectedId} disabled={busy}
      onChange={change => setSelectedId(change.target.value)}>
      {events.map(event => <MenuItem key={event.id} value={event.id}>{formatSiteDate(event.startDate)} · {event.title} · {event.section}</MenuItem>)}
    </TextField>}
    {!error && !loaded && <span role="status">Loading events…</span>}
    {loaded && !selectedId && <span role="status">No events in this scope.</span>}
    {selectedId && <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      <Button variant="contained" disabled={busy} onClick={() => void output("CSV")}>Export Roster CSV</Button>
      <Button variant="outlined" disabled={busy} onClick={() => void output("print")}>Print / Save PDF</Button>
    </Stack>}
  </Stack>;
}
