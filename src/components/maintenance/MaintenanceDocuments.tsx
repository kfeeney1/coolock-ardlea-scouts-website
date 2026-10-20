import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useAdminAuth } from "../admin/AdminAuthProvider";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { validateAttachmentUpload } from "../../services/attachmentLogic";
import { downloadMaintenanceDocument, listMaintenanceDocuments, uploadMaintenanceDocument, type MaintenanceDocument } from "../../services/maintenanceApi";
import { formatSiteDate } from "../../services/siteDateFormat";
function DocumentPicker({label, disabled, onFile}: {label: string; disabled: boolean; onFile: (file?: File) => void}) {
  const input = useRef<HTMLInputElement>(null);
  return <><Button type="button" variant="contained" disabled={disabled} onClick={() => input.current?.click()} sx={{minHeight: 44}}>{label}</Button><input ref={input} aria-label={label} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={e => {const file = e.target.files?.[0]; e.target.value = ""; onFile(file);}} /></>;
}
export default function MaintenanceDocuments() {
  const { user } = useAdminAuth();
  const [documents, setDocuments] = useState<MaintenanceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState("");
  const operation = useRef<{file: File; id: string} | null>(null);
  const lock = useRef(false);
  const load = async (after = "") => { const result = await listMaintenanceDocuments(after); setDocuments(previous => after ? [...previous, ...result.documents] : result.documents); setNext(result.next); };
  useEffect(() => { void load().catch(e => setError(applicationErrorMessage(e, "Unable to load documents.", "MaintenanceDocuments"))).finally(() => setLoading(false)); }, []);
  const upload = async (file?: File, retryId?: string) => {
    if (lock.current || !file) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    try {
      validateAttachmentUpload({ownerType: "finance-receipt", ownerId: "maintenance", section: "Group", fileName: file.name, contentType: file.type, size: file.size});
      if (operation.current?.file !== file || retryId) operation.current = {file, id: retryId || crypto.randomUUID()};
      await uploadMaintenanceDocument(file, operation.current!.id);
      setMessage("Document uploaded successfully."); operation.current = null;
      try { await load(); } catch { setError("Document saved, but the list could not refresh. Reload the page to view it."); }
    } catch (e) { setError(applicationErrorMessage(e, "Upload did not finish. Retry to resume the same upload.", "MaintenanceDocuments")); }
    finally { lock.current = false; setBusy(false); }
  };
  const download = async (id: string, open: boolean) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try { await downloadMaintenanceDocument(id, open); } catch (e) { setError(applicationErrorMessage(e, "Unable to retrieve this document.", "MaintenanceDocuments")); }
    finally { lock.current = false; setBusy(false); }
  };
  const picker = (label: string, id?: string) => <DocumentPicker label={label} disabled={busy} onFile={file => void upload(file, id)} />;
  return <Stack spacing={2}>
    <Typography component="h2" variant="h5" color="secondary">Documents</Typography>
    <Typography>PDF, JPEG, PNG or WebP · up to 10 MB. Files are available only to group members.</Typography>
    {picker("Upload document")}
    {loading && <Typography role="status">Loading documents…</Typography>}
    {busy && <Typography role="status">Working…</Typography>}
    {error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success" role="status">{message}</Alert>}
    {operation.current && !busy && <Button onClick={() => void upload(operation.current!.file)} sx={{minHeight: 44}}>Retry upload</Button>}
    {!loading && !documents.length && !error && <Alert severity="info">No maintenance documents yet.</Alert>}
    {next && <Button disabled={busy} onClick={() => { setBusy(true); void load(next).catch(() => setError("Unable to load more documents. Try again.")).finally(() => setBusy(false)); }} sx={{minHeight: 44}}>Load more documents</Button>}
    {documents.map(doc => <Paper key={doc.id} variant="outlined" sx={{p: 2, borderRadius: 3}}><Stack spacing={1}>
      <Typography sx={{fontWeight: 800, overflowWrap: "anywhere"}}>{doc.fileName}</Typography>
      <Typography variant="body2">{formatSiteDate(new Date(doc.uploadedAt).toISOString().slice(0, 10))} · {Math.ceil(doc.size / 1024)} KB · {doc.state === "ready" ? "Ready" : "Upload incomplete"}</Typography>
      <Stack direction={{xs: "column", sm: "row"}} spacing={1}>{doc.state === "ready" ? <><Button disabled={busy} onClick={() => void download(doc.id, true)} sx={{minHeight: 44}}>Open</Button><Button disabled={busy} onClick={() => void download(doc.id, false)} sx={{minHeight: 44}}>Download</Button></> : doc.uploadedBy === user?.uid && picker("Resume upload", doc.id)}</Stack>
    </Stack></Paper>)}
  </Stack>;
}
