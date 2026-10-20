import { Alert, Button, Stack, Typography } from "@mui/material";
import { useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { maintenanceTasks, type MaintenanceTask } from "../../services/maintenanceApi";
import MaintenanceAssigneeField from "./MaintenanceAssigneeField";
export default function MaintenanceTaskProgress({task, onSaved}: {task: MaintenanceTask; onSaved: (task: MaintenanceTask) => void}) {
  const [assigneeUid, setAssignee] = useState(task.assigneeUid);
  const [saving, setSaving] = useState(false); const lock = useRef(false);
  const [error, setError] = useState(""); const [saved, setSaved] = useState(false);
  const update = async (status: "open" | "complete") => {
    if (lock.current) return; lock.current = true; setSaving(true); setError(""); setSaved(false);
    try { const result = await maintenanceTasks<{task: MaintenanceTask}>({action: "update", id: task.id, revision: task.revision, status, assigneeUid}); onSaved(result.task); setAssignee(result.task.assigneeUid); setSaved(true); }
    catch (e) { setError(applicationErrorMessage(e, "Unable to save responsibility or progress. Your selection has been retained.", "MaintenanceTaskProgress")); }
    finally { lock.current = false; setSaving(false); }
  };
  return <Stack spacing={2}>
    <Typography component="h3" variant="h6">Responsibility and progress</Typography>
    {error && <Alert severity="error">{error}</Alert>}{saved && <Alert severity="success" role="status">Task updated successfully.</Alert>}
    <MaintenanceAssigneeField value={assigneeUid} onChange={setAssignee} disabled={saving} />
    <Stack direction={{xs: "column", sm: "row"}} spacing={1}><Button disabled={saving} onClick={() => void update(task.status)} variant="contained" sx={{minHeight: 44}}>Save responsibility</Button><Button disabled={saving} onClick={() => void update(task.status === "complete" ? "open" : "complete")} variant="contained" color="success" sx={{minHeight: 44}}>{task.status === "complete" ? "Reopen task" : "Mark complete"}</Button></Stack>
  </Stack>;
}
