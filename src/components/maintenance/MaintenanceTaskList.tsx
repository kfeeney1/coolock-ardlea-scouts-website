import { Alert, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { maintenanceTasks, type MaintenanceTask } from "../../services/maintenanceApi";
export default function MaintenanceTaskList() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { void maintenanceTasks<{tasks: MaintenanceTask[]}>({action: "list"}).then(result => setTasks(result.tasks)).catch(e => setError(applicationErrorMessage(e, "Unable to load maintenance tasks.", "MaintenanceTasks"))).finally(() => setLoading(false)); }, []);
  return <Stack spacing={2}>
    <Typography component="h2" variant="h5" color="secondary">Tasks</Typography>
    <Button component={Link} to="/maintenance/tasks/new" variant="contained" sx={{minHeight: 44, alignSelf: "flex-start"}}>Raise a task</Button>
    {loading && <Typography role="status">Loading tasks…</Typography>}{error && <Alert severity="error">{error}</Alert>}
    {!loading && !tasks.length && !error && <Alert severity="info">No maintenance tasks yet.</Alert>}
    {tasks.map(task => <Paper key={task.id} variant="outlined" sx={{p: 2, borderRadius: 3}}><Stack spacing={1}>
      <Chip label={task.status === "complete" ? "Complete" : "Open"} color={task.status === "complete" ? "success" : "info"} sx={{alignSelf: "flex-start"}} />
      <Typography sx={{display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", whiteSpace: "pre-wrap"}}>{task.description}</Typography>
      <Typography variant="body2">Responsible leader: {task.assigneeName} · {task.documentIds.length} linked document(s)</Typography>
      <Button component={Link} to={`/maintenance/tasks/${task.id}`} sx={{minHeight: 44, alignSelf: "flex-start"}}>View task</Button>
    </Stack></Paper>)}
  </Stack>;
}
