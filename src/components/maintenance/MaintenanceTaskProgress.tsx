import { Alert, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { db } from "../../firebase";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { maintenanceTasks, type MaintenanceTask } from "../../services/maintenanceApi";
import { loadMaintenanceLeaders } from "../../services/maintenanceDirectoryStore";
import type { MaintenanceLeader } from "../../services/maintenanceAssignmentPolicy";
import MaintenanceAssigneeField from "./MaintenanceAssigneeField";
export default function MaintenanceTaskProgress({task, onSaved}: {task: MaintenanceTask; onSaved: (task: MaintenanceTask) => void}) {
  const [leaders, setLeaders] = useState<MaintenanceLeader[]>([]);
  const [assigneeUid, setAssigneeUid] = useState(task.assigneeUid);
  const [status, setStatus] = useState(task.status);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  const load = () => { setLoading(true); setError(""); void loadMaintenanceLeaders(db).then(setLeaders).catch(e => setError(applicationErrorMessage(e, "Unable to load eligible leaders.", "MaintenanceTaskProgress"))).finally(() => setLoading(false)); };
  useEffect(load, []);
  const save = async () => {
    if (lock.current) return;
    lock.current = true; setSaving(true); setSaved(false); setError("");
    try {
      await maintenanceTasks({action: "update", id: task.id, revision: task.revision, assigneeUid, status});
      const result = await maintenanceTasks<{task: MaintenanceTask}>({action: "get", id: task.id});
      onSaved(result.task); setSaved(true);
    } catch (e) { setError(applicationErrorMessage(e, "Unable to save task progress. Your choices have been retained.", "MaintenanceTaskProgress")); }
    finally { lock.current = false; setSaving(false); }
  };
  return <Stack component="form" spacing={2} onSubmit={event => {event.preventDefault(); void save();}}>
    <Typography component="h3" variant="h6">Assignment and progress</Typography>
    {loading && <Typography role="status">Loading eligible leaders…</Typography>}
    {error && <Alert severity="error">{error}<Button onClick={load} disabled={saving} sx={{minHeight: 44}}>Refresh leader choices</Button><Button disabled={saving} sx={{minHeight: 44}} onClick={() => {void maintenanceTasks<{task: MaintenanceTask}>({action: "get", id: task.id}).then(result => onSaved(result.task)).catch(e => setError(applicationErrorMessage(e, "Unable to reload task details.", "MaintenanceTaskProgress")));}}>Reload task details</Button></Alert>}
    {saved && <Alert severity="success" role="status">Task progress saved successfully.</Alert>}
    <MaintenanceAssigneeField leaders={leaders} value={assigneeUid} onChange={setAssigneeUid} disabled={loading || saving} />
    <TextField select label="Task status" value={status} onChange={event => setStatus(event.target.value as "open" | "complete")} disabled={saving}>
      <MenuItem value="open" sx={{minHeight: 44}}>Open</MenuItem><MenuItem value="complete" sx={{minHeight: 44}}>Complete</MenuItem>
    </TextField>
    <Button type="submit" variant="contained" disabled={loading || saving} sx={{minHeight: 44}}>{saving ? "Saving…" : "Save progress"}</Button>
  </Stack>;
}
