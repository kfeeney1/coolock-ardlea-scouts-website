import { Alert, Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { maintenanceDocumentChoices, maintenanceTasks, type MaintenanceDocument } from "../../services/maintenanceApi";
export default function MaintenanceTaskCreate() {
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [documents, setDocuments] = useState<MaintenanceDocument[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const id = useRef(crypto.randomUUID()); const lock = useRef(false);
  useEffect(() => { void maintenanceDocumentChoices().then(setDocuments).catch(e => setError(applicationErrorMessage(e, "Unable to load documents. You can still raise a task without a document.", "MaintenanceTaskCreate"))).finally(() => setLoading(false)); }, []);
  const save = async () => {
    if (lock.current) return;
    if (!description.trim()) { setError("Enter a task description."); return; }
    lock.current = true; setSaving(true); setError("");
    try { await maintenanceTasks({action: "create", id: id.current, description, documentIds}); navigate(`/maintenance/tasks/${id.current}`, {replace: true, state: {maintenanceSaved: true}}); }
    catch (e) { setError(applicationErrorMessage(e, "Unable to save this task. Your details have been retained.", "MaintenanceTaskCreate")); }
    finally { lock.current = false; setSaving(false); }
  };
  return <Stack component="form" spacing={2} onSubmit={e => {e.preventDefault(); void save();}}>
    <Button component={Link} to="/maintenance/tasks" sx={{minHeight: 44, alignSelf: "flex-start"}}>Back to Tasks</Button>
    <Typography component="h2" variant="h5" color="secondary">Raise a task</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    <TextField label="Task description" required multiline minRows={4} value={description} onChange={e => setDescription(e.target.value)} slotProps={{htmlInput: {maxLength: 8000}}} disabled={saving} />
    <Typography component="h3" variant="h6">Linked documents (optional)</Typography>
    {loading && <Typography role="status">Loading document choices…</Typography>}
    {documents.map(doc => <FormControlLabel key={doc.id} sx={{minHeight: 44, overflowWrap: "anywhere"}} control={<Checkbox disabled={saving} checked={documentIds.includes(doc.id)} onChange={(_, checked) => setDocumentIds(ids => checked ? [...ids, doc.id] : ids.filter(id => id !== doc.id))} />} label={doc.fileName} />)}
    <Button variant="contained" type="submit" disabled={saving} sx={{minHeight: 44}}>{saving ? "Saving…" : "Save task"}</Button>
  </Stack>;
}
