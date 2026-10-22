import { Alert, Button, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useCalendarMaintenance } from "../hooks/useCalendarMaintenance";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import ExpandableMeetingNotes from "../components/admin/ExpandableMeetingNotes";
import AppointmentEditor from "../components/calendar/AppointmentEditor";
import { emptyAppointment, type MaintenanceAppointment as Appointment } from "../services/maintenanceAppointmentLogic";
import { validAppointmentId, watchMaintenanceAppointment } from "../services/maintenanceAppointmentStore";
import { calendarReturnPath } from "../services/calendarSourceLogic";
import { formatSiteDate } from "../services/siteDateFormat";
import { scheduleToday } from "../services/scheduleSelection";
export default function MaintenanceAppointment() {
  const access = useCalendarMaintenance(), {authorised} = useAdminAuth();
  const {id = ""} = useParams(); const location = useLocation();
  const back = calendarReturnPath(location.state) || "/calendar";
  const creating = id === "new", editing = creating || location.pathname.endsWith("/edit");
  const [newId] = useState(() => crypto.randomUUID()), [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({key: "", record: null as Appointment | null, loaded: false, error: false});
  const key = JSON.stringify([id, access.key, access.allowed, attempt]);
  useEffect(() => {
    setState({key, record: null, loaded: false, error: false});
    if (!access.allowed || creating || !validAppointmentId(id)) return;
    const deadline = setTimeout(() => {stop(); setState({key, record: null, loaded: true, error: true});}, 15000);
    const stop = watchMaintenanceAppointment(id, record => {clearTimeout(deadline); setState({key, record, loaded: true, error: false});}, () => {clearTimeout(deadline); setState({key, record: null, loaded: true, error: true});});
    return () => {clearTimeout(deadline); stop();};
  }, [key]);
  if (access.loading) return <Container sx={{py: 4}}><Typography role="status">Loading Maintenance appointment…</Typography></Container>;
  if (!access.allowed) return <Container sx={{py: 4}}><Alert severity={access.error ? "error" : "info"}>{access.error || "Appointments require Calendar and Maintenance to be enabled and current group membership."}</Alert>{access.error && <Button onClick={access.retry}>Retry access</Button>}</Container>;
  const record = state.key === key && !state.record?.taskId ? state.record : null;
  const params = new URLSearchParams(back.split("?")[1] || ""), today = scheduleToday();
  const month = params.get("month"), defaultDate = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month === today.slice(0, 7) ? today : `${month}-01` : today;
  return <Container maxWidth="md" sx={{py: 4, overflowWrap: "anywhere"}}>
    {authorised && <LeaderDashboardHeader />}
    <Stack spacing={2}>
      <Button component={Link} to={back} sx={{alignSelf: "flex-start", minHeight: 44}}>Back to calendar</Button>
      <Typography component="h1" variant="h3" color="secondary" sx={{fontWeight: 800, fontSize: {xs: "1.75rem", md: "3rem"}}}>Maintenance appointment</Typography>
      {!creating && validAppointmentId(id) && (state.key !== key || !state.loaded) ? <Typography role="status">Loading appointment…</Typography> : !creating && !record ? <><Alert severity={state.error ? "error" : "info"}>This appointment is unavailable. It may have been removed or no longer be accessible.</Alert><Button onClick={() => setAttempt(value => value + 1)}>Retry appointment</Button></> : <Paper variant="outlined" sx={{p: {xs: 2, sm: 3}, borderRadius: 3, borderTop: "6px solid", borderTopColor: "secondary.main"}}>
        {editing ? <AppointmentEditor key={creating ? newId : `${id}:${attempt}`} id={creating ? newId : id} initial={record || emptyAppointment(defaultDate)} revision={record?.revision || 0} back={back} /> : record && <Stack spacing={2}>
          <Typography component="h2" variant="h4">{record.title}</Typography>
          <Typography>Maintenance · Group-wide</Typography><Typography>{formatSiteDate(record.date)} · {record.allDay ? "All day" : `${record.startTime} – ${record.endTime} (Europe/Dublin)`}</Typography>
          {record.location && <Typography>{record.location}</Typography>}{record.notes && <ExpandableMeetingNotes notes={record.notes} />}
          <Button component={Link} to={`/calendar/maintenance/${id}/edit`} state={{calendarReturnTo: back}} sx={{alignSelf: "flex-start", minHeight: 44}}>Edit appointment</Button>
        </Stack>}
      </Paper>}
    </Stack>
  </Container>;
}
