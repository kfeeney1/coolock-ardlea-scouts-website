import { Alert, Button, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useCalendarMaintenance } from "../hooks/useCalendarMaintenance";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import MaintenanceTaskList from "../components/maintenance/MaintenanceTaskList";
import AppointmentEditor from "../components/calendar/AppointmentEditor";
import ExpandableMeetingNotes from "../components/admin/ExpandableMeetingNotes";
import { calendarReturnPath } from "../services/calendarSourceLogic";
import { taskAppointmentId, watchMaintenanceTask } from "../services/maintenanceTaskCalendar";
import { watchMaintenanceAppointment } from "../services/maintenanceAppointmentStore";
import { emptyAppointment, type MaintenanceAppointment } from "../services/maintenanceAppointmentLogic";
import type { MaintenanceTask } from "../services/maintenanceTaskStore";
import { scheduleToday } from "../services/scheduleSelection";
export default function ScheduleMaintenanceTask() {
  const access = useCalendarMaintenance(), {authorised} = useAdminAuth(), {taskId = ""} = useParams();
  const location = useLocation(), back = calendarReturnPath(location.state) || "/calendar";
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({key: "", task: null as MaintenanceTask | null, record: null as MaintenanceAppointment | null, loaded: false, error: false});
  const key = JSON.stringify([taskId, access.key, access.allowed, attempt]);
  useEffect(() => {
    setState({key, task: null, record: null, loaded: false, error: false});
    if (!access.allowed || !/^[a-zA-Z0-9-]{20,64}$/.test(taskId)) return;
    let active = true, taskReady = false, recordReady = false;
    let task: MaintenanceTask | null = null, record: MaintenanceAppointment | null = null;
    const emit = () => {if (active && taskReady && recordReady) {clearTimeout(deadline); setState({key, task, record, loaded: true, error: false});}};
    const failed = () => {if (active) {clearTimeout(deadline); setState({key, task: null, record: null, loaded: true, error: true});}};
    const deadline = setTimeout(failed, 15000);
    const stopTask = watchMaintenanceTask(taskId, value => {task = value; taskReady = true; emit();}, failed);
    const stopRecord = watchMaintenanceAppointment(taskAppointmentId(taskId), value => {record = value; recordReady = true; if (taskReady) clearTimeout(deadline); emit();}, failed);
    return () => {active = false; clearTimeout(deadline); stopTask(); stopRecord();};
  }, [key]);
  if (access.loading) return <Container sx={{py: 4}}><Typography role="status">Loading task scheduling…</Typography></Container>;
  if (!access.allowed) return <Container sx={{py: 4}}><Alert severity="info">{access.error || "Task scheduling requires Calendar, Maintenance and current group membership."}</Alert>{access.error && <Button onClick={access.retry}>Retry access</Button>}</Container>;
  const current = state.key === key ? state : null;
  const month = new URLSearchParams(back.split("?")[1] || "").get("month"), today = scheduleToday();
  const date = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month !== today.slice(0, 7) ? `${month}-01` : today;
  return <Container maxWidth="md" sx={{py: 4, overflowWrap: "anywhere"}}>
    {authorised && <LeaderDashboardHeader />}
    <Stack spacing={2}>
      <Button component={Link} to={back} sx={{minHeight: 44, alignSelf: "flex-start"}}>Back to calendar</Button>
      <Typography component="h1" variant="h3" color="secondary" sx={{fontWeight: 800, fontSize: {xs: "1.75rem", md: "3rem"}}}>Schedule maintenance task</Typography>
      {!taskId ? <MaintenanceTaskList schedule calendarReturnTo={back} /> : !/^[a-zA-Z0-9-]{20,64}$/.test(taskId) || current?.loaded && (!current.task || current.error) ? <><Alert severity="info">This source task is unavailable. Return to Maintenance or retry.</Alert><Button onClick={() => setAttempt(value => value + 1)}>Retry task</Button></> : !current?.loaded ? <Typography role="status">Loading source task…</Typography> : <Paper variant="outlined" sx={{p: 3, borderRadius: 3, borderTop: "6px solid", borderTopColor: "secondary.main"}}><Stack spacing={2}>
        <Typography component="h2" variant="h5">Source task</Typography><ExpandableMeetingNotes notes={current.task!.description} />
        <Typography>Responsible leader: {current.task!.assigneeName} · {current.task!.status === "complete" ? "Complete" : "Open"}</Typography>
        <Button component={Link} to={`/maintenance/tasks/${taskId}`} state={{calendarReturnTo: back}}>Open source task</Button>
        <AppointmentEditor key={`${taskId}:${attempt}`} id={taskAppointmentId(taskId)} taskId={taskId} initial={current.record || emptyAppointment(date)} revision={current.record?.revision || 0} back={back} />
      </Stack></Paper>}
    </Stack>
  </Container>;
}
