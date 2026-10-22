import { watchMaintenanceTask } from "../../services/maintenanceTaskCalendar";
import TaskScheduleSummary from "../calendar/TaskScheduleSummary";
import ExpandableMeetingNotes from "../admin/ExpandableMeetingNotes";
import MaintenanceTaskProgress from "./MaintenanceTaskProgress";
import { Alert, Button, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { downloadMaintenanceDocument, maintenanceDocumentChoices, type MaintenanceTask, type MaintenanceDocument } from "../../services/maintenanceApi";
export default function MaintenanceTaskDetails({id}: {id: string}) {
  const location = useLocation();
  const [task, setTask] = useState<MaintenanceTask | null>(null);
  const [documents, setDocuments] = useState<MaintenanceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; setTask(null); setLoading(true); setError("");
    void maintenanceDocumentChoices().then(docs => {if (active) setDocuments(docs);}).catch(() => {if (active) setError("Unable to load linked document choices.");});
    const stop = watchMaintenanceTask(id, task => {if (active) {setTask(task); setLoading(false); setError(previous => !task ? "This task is unavailable. It may have been removed or no longer be accessible." : previous.startsWith("This task is unavailable.") ? "" : previous);}}, () => {if (active) {setTask(null); setLoading(false); setError("This task is unavailable. Return to Maintenance to retry.");}});
    return () => {active = false; stop();};
  }, [id]);
  return <Stack spacing={2}>
    <Button component={Link} to="/maintenance/tasks" sx={{minHeight: 44, alignSelf: "flex-start"}}>Back to Tasks</Button>
    <Typography component="h2" variant="h5" color="secondary">Task details</Typography>
    {(location.state as {maintenanceSaved?: boolean} | null)?.maintenanceSaved && <Alert severity="success" role="status">Task saved successfully.</Alert>}
    {loading && <Typography role="status">Loading task…</Typography>}{error && <Alert severity="error">{error}</Alert>}
    {task && <><Chip label={task.status === "complete" ? "Complete" : "Open"} color={task.status === "complete" ? "success" : "info"} sx={{alignSelf: "flex-start"}} /><ExpandableMeetingNotes notes={task.description} /><Typography>Responsible leader: {task.assigneeName}</Typography><Typography component="h3" variant="h6">Linked documents</Typography>{!task.documentIds.length && <Typography>No linked documents.</Typography>}{task.documentIds.map(docId => <Button key={docId} onClick={() => { void downloadMaintenanceDocument(docId, false).catch(e => setError(applicationErrorMessage(e, "Unable to download document.", "MaintenanceTaskDetails"))); }} sx={{minHeight: 44, overflowWrap: "anywhere"}}>{documents.find(doc => doc.id === docId)?.fileName || "Download linked document"}</Button>)}<MaintenanceTaskProgress task={task} onSaved={setTask} /><TaskScheduleSummary taskId={task.id} /></>}
  </Stack>;
}
