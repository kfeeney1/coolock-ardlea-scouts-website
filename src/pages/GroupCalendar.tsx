import { useState } from "react";
import CalendarDateActions from "../components/calendar/CalendarDateActions";
import { useCalendarMaintenance } from "../hooks/useCalendarMaintenance";
import { useMaintenanceCalendarEntries } from "../hooks/useMaintenanceCalendarEntries";
import { useCalendarSources } from "../hooks/useCalendarSources";
import { Alert, Button, Container, Paper, Stack, Typography, TextField, MenuItem } from "@mui/material";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import CalendarPageLayout from "../components/calendar/CalendarPageLayout";
import CalendarMonthToolbar from "../components/calendar/CalendarMonthToolbar";
import CalendarMonthGrid from "../components/calendar/CalendarMonthGrid";
import { useCalendarAccess } from "../hooks/useCalendarAccess";
import { calendarMonth, calendarTypes, type CalendarFilter } from "../services/groupCalendar";
import { scheduleToday } from "../services/scheduleSelection";
export default function GroupCalendar() {
  const [actionDate, setActionDate] = useState("");
  const access = useCalendarAccess();
  const { user, authorised } = useAdminAuth();
  const [params, setParams] = useSearchParams();
  const today = scheduleToday();
  const month = calendarMonth(params.get("month"), today);
  const maintenance = useCalendarMaintenance(), location = useLocation();
  const appointments = useMaintenanceCalendarEntries(maintenance.allowed, maintenance.key, month);
  const sources = useCalendarSources(access.allowed, month, access.revision);
  const records = {...sources, entries: [...sources.entries, ...appointments.entries], sections: [...new Set([...sources.sections, ...(maintenance.allowed ? ["Group"] : [])])].sort(), loading: sources.loading || appointments.loading || maintenance.loading};
  const returnTo = `/calendar?month=${month}&type=${params.get("type") || "all"}${params.get("section") ? `&section=${encodeURIComponent(params.get("section")!)}` : ""}`;
  const requestedSection = params.get("section") || "";
  const section = records.sections.includes(requestedSection) ? requestedSection : "";
  const type = calendarTypes.includes(params.get("type") as CalendarFilter) ? params.get("type") as CalendarFilter : "all";
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); next.set("month", month); next.set(key, value); setParams(next, {replace: true}); };
  if (access.loading) return <Container sx={{py: 4}}><Typography role="status">Loading Calendar…</Typography></Container>;
  if (!access.allowed) return <Container sx={{py: 4}}><Alert severity={access.error ? "error" : "info"}>{access.error || (!user ? "Sign in to access Calendar." : !access.enabled ? "Calendar is currently disabled." : "Calendar is restricted to approved group members.")}</Alert>{access.error && <Button onClick={access.retry} sx={{minHeight: 44}}>Retry Calendar</Button>}{!user && <Button component={Link} to="/parent" sx={{minHeight: 44}}>Sign in</Button>}</Container>;
  return <CalendarPageLayout wide title="Group calendar" subtitle="Meetings, events and maintenance together." back={authorised ? "/leader" : "/parent"} backLabel={`Back to ${authorised ? "Dashboard" : "Parent Portal"}`}>
    <Stack spacing={2} data-testid="page-group-calendar">
      {location.state?.calendarSaved && <Alert severity="success" role="status">Maintenance appointment saved.</Alert>}
      {maintenance.error && <Alert severity="error" action={<Button onClick={maintenance.retry}>Retry Maintenance</Button>}>{maintenance.error}</Alert>}
      {appointments.error && <Alert severity="error" action={<Button onClick={appointments.retry}>Retry appointments</Button>}>{appointments.error}</Alert>}
      <Paper variant="outlined" sx={{p: {xs: 1, sm: 2}, borderRadius: 3, bgcolor: "background.paper"}}>
        <Stack spacing={2}>
          <CalendarMonthToolbar month={month} today={today} type={type} update={update} />
          <TextField size="small" select label="Calendar section" value={section} disabled={records.loading || Boolean(records.error)} onChange={event => update("section", event.target.value)}>
            <MenuItem value="">All permitted sections</MenuItem>
            {records.sections.map(value => <MenuItem key={value} value={value}>{value === "Group" ? "Group-wide" : value}</MenuItem>)}
          </TextField>
          {records.loading && <Typography role="status">Loading Calendar records…</Typography>}
          {records.error && <Alert severity="error" action={<Button onClick={records.retry}>Retry records</Button>}>{records.error}</Alert>}
          <CalendarMonthGrid onDateAction={setActionDate} month={month} today={today} entries={records.entries} type={type} section={section} returnTo={`/calendar?month=${month}&type=${type}${section ? `&section=${encodeURIComponent(section)}` : ""}`} />
          {!records.loading && !records.error && !records.entries.length && <Alert severity="info" role="status">No shared meetings, events or maintenance in this month.</Alert>}
          {!records.loading && !records.error && records.entries.length > 0 && !records.entries.some(entry => (type === "all" || entry.type === type) && (!section || entry.section === section)) && <Alert severity="info" role="status">No records match these filters. <Button onClick={() => {const next = new URLSearchParams(); next.set("month", month); setParams(next, {replace: true});}}>Clear filters</Button></Alert>}
          <Typography variant="body2" color="text.secondary">Only records shared with your account are shown.</Typography>

        </Stack>
      </Paper>
      <Stack direction={{xs: "column", sm: "row"}} spacing={1}>
      {maintenance.allowed && <Button component={Link} to="/calendar/maintenance/new" data-calendar-schedule-action disabled={records.loading} state={{calendarReturnTo: returnTo}} color="secondary" sx={{minHeight: 44, borderRadius: 2, boxShadow: "none"}}>Schedule maintenance</Button>}
      {maintenance.allowed && <Button component={Link} to="/calendar/maintenance/tasks" data-calendar-schedule-action disabled={records.loading} state={{calendarReturnTo: returnTo}} color="secondary" sx={{minHeight: 44, borderRadius: 2, boxShadow: "none"}}>Schedule maintenance task</Button>}
      </Stack>
      <CalendarDateActions date={actionDate} onClose={() => setActionDate("")} returnTo={returnTo} maintenance={maintenance.allowed} />
    </Stack>
  </CalendarPageLayout>;
}
