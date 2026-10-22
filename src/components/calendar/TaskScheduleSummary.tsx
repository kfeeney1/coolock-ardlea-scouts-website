import { Alert, Button, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCalendarMaintenance } from "../../hooks/useCalendarMaintenance";
import { taskAppointmentId } from "../../services/maintenanceTaskCalendar";
import { watchMaintenanceAppointment } from "../../services/maintenanceAppointmentStore";
import type { MaintenanceAppointment } from "../../services/maintenanceAppointmentLogic";
import { calendarReturnPath } from "../../services/calendarSourceLogic";
import { formatSiteDate } from "../../services/siteDateFormat";
export default function TaskScheduleSummary({taskId}: {taskId: string}) {
  const access = useCalendarMaintenance(), location = useLocation();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({key: "", loaded: false, record: null as MaintenanceAppointment | null, error: false});
  const key = JSON.stringify([taskId, access.key, access.allowed, attempt]);
  useEffect(() => {
    setState({key, loaded: false, record: null, error: false});
    if (!access.allowed) return;
    const failed = () => setState({key, loaded: true, record: null, error: true});
    const deadline = setTimeout(() => {stop(); failed();}, 15000);
    const stop = watchMaintenanceAppointment(taskAppointmentId(taskId), record => {clearTimeout(deadline); setState({key, loaded: true, record, error: false});}, () => {clearTimeout(deadline); failed();});
    return () => {clearTimeout(deadline); stop();};
  }, [key]);
  if (!access.allowed) return null;
  const current = state.key === key ? state : null;
  return <Stack spacing={1}>
    <Typography component="h3" variant="h6">Calendar schedule</Typography>
    {!current?.loaded ? <Typography role="status">Loading task schedule…</Typography> : current.error ? <Alert severity="error" action={<Button onClick={() => setAttempt(value => value + 1)}>Retry schedule</Button>}>Unable to load task schedule.</Alert> : current.record ? <Typography>{formatSiteDate(current.record.date)} · {current.record.allDay ? "All day" : `${current.record.startTime} – ${current.record.endTime}`}</Typography> : <Typography>Not scheduled.</Typography>}
    <Button component={Link} to={`/calendar/maintenance/tasks/${taskId}`} state={{calendarReturnTo: calendarReturnPath(location.state) || "/calendar"}} sx={{minHeight: 44, alignSelf: "flex-start"}}>{current?.record ? "Reschedule task" : "Schedule task"}</Button>
  </Stack>;
}
