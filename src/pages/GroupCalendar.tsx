import { Alert, Button, Container, Paper, Stack, Typography } from "@mui/material";
import { Link, useSearchParams } from "react-router-dom";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import CalendarMonthGrid from "../components/calendar/CalendarMonthGrid";
import { useCalendarAccess } from "../hooks/useCalendarAccess";
import { calendarMonth, calendarMonthCaption, calendarTypes, shiftCalendarMonth, type CalendarFilter } from "../services/groupCalendar";
import { scheduleToday } from "../services/scheduleSelection";
const labels = {all: "All", meeting: "Meetings", event: "Events", maintenance: "Maintenance"};
export default function GroupCalendar() {
  const access = useCalendarAccess();
  const { user, authorised } = useAdminAuth();
  const [params, setParams] = useSearchParams();
  const today = scheduleToday();
  const month = calendarMonth(params.get("month"), today);
  const type = calendarTypes.includes(params.get("type") as CalendarFilter) ? params.get("type") as CalendarFilter : "all";
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); next.set("month", month); next.set(key, value); setParams(next, {replace: true}); };
  if (access.loading) return <Container sx={{py: 4}}><Typography role="status">Loading Calendar…</Typography></Container>;
  if (!access.allowed) return <Container sx={{py: 4}}><Alert severity={access.error ? "error" : "info"}>{access.error || (!user ? "Sign in to access Calendar." : !access.enabled ? "Calendar is currently disabled." : "Calendar is restricted to approved group members.")}</Alert>{access.error && <Button onClick={access.retry} sx={{minHeight: 44}}>Retry Calendar</Button>}{!user && <Button component={Link} to="/parent" sx={{minHeight: 44}}>Sign in</Button>}</Container>;
  return <Container maxWidth="xl" data-testid="page-group-calendar" sx={{py: 4, px: {xs: 1, sm: 3}, overflowWrap: "anywhere"}}>
    {authorised && <LeaderDashboardHeader />}
    <Stack spacing={2}>
      <Button component={Link} to={authorised ? "/leader" : "/parent"} sx={{alignSelf: "flex-start", minHeight: 44}}>Back to {authorised ? "Dashboard" : "Parent Portal"}</Button>
      <Typography component="h1" variant="h3" color="secondary" sx={{fontWeight: 800, fontSize: {xs: "1.75rem", md: "3rem"}}}>Group calendar</Typography>
      <Typography>Meetings, events and maintenance together.</Typography>
      <Paper variant="outlined" sx={{p: {xs: 1, sm: 2}, borderRadius: 3, borderTop: "6px solid", borderTopColor: "secondary.main"}}>
        <Stack spacing={2}>
          <Stack direction="row" useFlexGap spacing={1} sx={{flexWrap: "wrap", alignItems: "center"}}>
            <Button aria-label="Previous month" onClick={() => update("month", shiftCalendarMonth(month, -1))} disabled={month === "1900-01"} sx={{minHeight: 44}}>Previous month</Button>
            <Typography component="h2" variant="h6" aria-live="polite">{calendarMonthCaption(month)}</Typography>
            <Button aria-label="Next month" onClick={() => update("month", shiftCalendarMonth(month, 1))} disabled={month === "2199-12"} sx={{minHeight: 44}}>Next month</Button>
            <Button onClick={() => update("month", today.slice(0, 7))} sx={{minHeight: 44}}>Today</Button>
          </Stack>
          <Stack component="nav" aria-label="Calendar type filters" direction="row" useFlexGap spacing={1} sx={{flexWrap: "wrap"}}>
            {calendarTypes.map(option => <Button key={option} aria-pressed={type === option} color={type === option ? "secondary" : "primary"} variant={type === option ? "contained" : "outlined"} onClick={() => update("type", option)} sx={{minHeight: 44}}>{labels[option]}</Button>)}
          </Stack>
          <Alert severity="info" role="status">Calendar sources are being integrated. Keep Calendar disabled until meeting, event and Maintenance acceptance is complete.</Alert>
          <CalendarMonthGrid month={month} today={today} entries={[]} type={type} section="" returnTo={`/calendar?month=${month}&type=${type}`} />
        </Stack>
      </Paper>
    </Stack>
  </Container>;
}
