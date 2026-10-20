import { Alert, Button, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { downloadMaintenanceDocument, maintenanceDocumentChoices, maintenanceTasks, type MaintenanceTask, type MaintenanceDocument } from "../../services/maintenanceApi";
export default function MaintenanceTaskDetails({id}: {id: string}) {
  const location = useLocation();
  const [task, setTask] = useState<MaintenanceTask | null>(null);
  const [documents, setDocuments] = useState<MaintenanceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { void Promise.all([maintenanceTasks<{task: MaintenanceTask}>({action: "get", id}), maintenanceDocumentChoices()]).then(([result, docs]) => {setTask(result.task); setDocuments(docs);}).catch(e => setError(applicationErrorMessage(e, "Unable to load this task.", "MaintenanceTaskDetails"))).finally(() => setLoading(false)); }, [id]);
  return <Stack spacing={2}>
    <Button component={Link} to="/maintenance/tasks" sx={{minHeight: 44, alignSelf: "flex-start"}}>Back to Tasks</Button>
    <Typography component="h2" variant="h5" color="secondary">Task details</Typography>
    {(location.state as {maintenanceSaved?: boolean} | null)?.maintenanceSaved && <Alert severity="success" role="status">Task saved successfully.</Alert>}
    {loading && <Typography role="status">Loading task…</Typography>}{error && <Alert severity="error">{error}</Alert>}
    {task && <><Chip label={task.status === "complete" ? "Complete" : "Open"} color={task.status === "complete" ? "success" : "info"} sx={{alignSelf: "flex-start"}} /><Typography sx={{whiteSpace: "pre-wrap", overflowWrap: "anywhere"}}>{task.description}</Typography><Typography>Responsible leader: {task.assigneeName}</Typography><Typography component="h3" variant="h6">Linked documents</Typography>{!task.documentIds.length && <Typography>No linked documents.</Typography>}{task.documentIds.map(docId => <Button key={docId} onClick={() => { void downloadMaintenanceDocument(docId, false).catch(e => setError(applicationErrorMessage(e, "Unable to download document.", "MaintenanceTaskDetails"))); }} sx={{minHeight: 44, overflowWrap: "anywhere"}}>{documents.find(doc => doc.id === docId)?.fileName || "Download linked document"}</Button>)}</>}
  </Stack>;
}
