import { maintenanceTaskTitle } from "../../services/maintenanceTaskCalendarLogic";
import { Alert, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { maintenanceTasks, type MaintenanceTask } from "../../services/maintenanceApi";
export default function MaintenanceTaskList({schedule = false, calendarReturnTo = "/calendar"}: {schedule?: boolean; calendarReturnTo?: string}) {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const load = async (after = "") => {
    const result = await maintenanceTasks<{tasks: MaintenanceTask[]; next: string}>({action: "list", after});
    setTasks(previous => after ? [...previous, ...result.tasks] : result.tasks); setNext(result.next);
  };
  useEffect(() => { void load().catch(e => setError(applicationErrorMessage(e, "Unable to load maintenance tasks.", "MaintenanceTasks"))).finally(() => setLoading(false)); }, []);
  return <Stack spacing={2}>
    <Typography component="h2" variant="h5" color="secondary">{schedule ? "Choose maintenance task" : "Tasks"}</Typography>
    {!schedule && <Button component={Link} to="/maintenance/tasks/new" variant="contained" sx={{minHeight: 44, alignSelf: "flex-start"}}>Raise a task</Button>}
    {loading && <Typography role="status">Loading tasks…</Typography>}{error && <Alert severity="error">{error}</Alert>}
    {!loading && !tasks.length && !error && <Alert severity="info">No maintenance tasks yet.</Alert>}
    {next && <Button disabled={loading} onClick={() => {setLoading(true); void load(next).catch(e => setError(applicationErrorMessage(e, "Unable to load more tasks.", "MaintenanceTasks"))).finally(() => setLoading(false));}} sx={{minHeight: 44}}>Load more tasks</Button>}
    {tasks.map(task => <Paper key={task.id} variant="outlined" sx={{p: 2, borderRadius: 3}}><Stack spacing={1}>
      <Chip label={task.status === "complete" ? "Complete" : "Open"} color={task.status === "complete" ? "success" : "info"} sx={{alignSelf: "flex-start"}} />
      <Typography sx={{display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", whiteSpace: "pre-wrap"}}>{task.description}</Typography>
      <Typography variant="body2">Responsible leader: {task.assigneeName} · {task.documentIds.length} linked document(s)</Typography>
      <Button component={Link} to={schedule ? `/calendar/maintenance/tasks/${task.id}` : `/maintenance/tasks/${task.id}`} aria-label={schedule ? `Schedule task: ${maintenanceTaskTitle(task.description)}` : undefined} state={schedule ? {calendarReturnTo} : undefined} sx={{minHeight: 44, alignSelf: "flex-start"}}>{schedule ? "Schedule this task" : "View task"}</Button>
    </Stack></Paper>)}
  </Stack>;
}
