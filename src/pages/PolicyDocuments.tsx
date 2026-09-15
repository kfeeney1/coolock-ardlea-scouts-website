import { Alert, Box, Button, Card, CardActions, CardContent, Chip, Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadPolicyDocuments, POLICY_AUDIENCES, publishPolicyDocument, revokePolicyDocumentUrls, withdrawPolicyDocument, type PolicyAudience, type PolicyDocument } from "../services/policyDocuments";

const GROUP_LEADERS = new Set(["Group Leader", "Deputy Group Leader", "Deputy-Group-Leader", "Deputy GroupLead", "DGL"]);

export default function PolicyDocuments() {
  const { adminProfile } = useAdminAuth();
  const canManage = adminProfile?.role === "admin" || adminProfile?.role === "super-admin" || GROUP_LEADERS.has(adminProfile?.scoutingRole || "");
  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<PolicyDocument | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState<PolicyAudience>("public");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [sourceOwner, setSourceOwner] = useState("");

  const refresh = async () => {
    setLoading(true); setError("");
    try {
      const next = await loadPolicyDocuments();
      setDocuments((current) => { revokePolicyDocumentUrls(current); return next; });
    } catch (loadError) {
      console.error("Unable to load policy documents:", loadError);
      setError("Unable to load policy documents.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    void refresh();
    return () => setDocuments((current) => { revokePolicyDocumentUrls(current); return []; });
  }, []);

  const categories = useMemo(() => Array.from(new Set(documents.map((item) => item.category))).sort(), [documents]);

  const publish = async () => {
    if (!file) { setError("Choose a PDF to publish."); return; }
    setPublishing(true); setError(""); setMessage("");
    try {
      await publishPolicyDocument({ title, description, category, audience, effectiveDate, sourceOwner, file });
      setMessage("Policy document published. It is now visible only to the selected audience.");
      setFile(null); setTitle(""); setDescription(""); setCategory(""); setEffectiveDate(""); setSourceOwner("");
      await refresh();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to publish policy document.");
    } finally { setPublishing(false); }
  };

  const withdraw = async () => {
    if (!removeTarget) return;
    setPublishing(true); setError("");
    try {
      await withdrawPolicyDocument(removeTarget);
      setMessage("Policy document withdrawn. The catalogue no longer exposes this version.");
      setRemoveTarget(null);
      await refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to withdraw policy document.");
    } finally { setPublishing(false); }
  };

  return <Box sx={{ minHeight: "100vh", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="lg">
      <Typography component="h1" variant="h3" sx={{ fontWeight: 800 }}>Policy documents</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Current approved Group policies and reference documents. Access is controlled by the audience selected when each document is published.</Typography>
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {canManage && <Card variant="outlined" sx={{ mb: 4 }}><CardContent>
        <Typography component="h2" variant="h5" sx={{ fontWeight: 800 }}>Publish approved document</Typography>
        <Typography color="text.secondary" sx={{ mt: .5, mb: 2 }}>Upload only an approved PDF. Uploading here is an explicit publication action; source authoring and review remain outside the website.</Typography>
        <Stack spacing={2}>
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={2} />
          <TextField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} required helperText="Use the Group's established category name; this does not create a separate category system." />
          <TextField select label="Audience" value={audience} onChange={(e) => setAudience(e.target.value as PolicyAudience)}>{POLICY_AUDIENCES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
          <TextField label="Effective / version date" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Source owner / reference" value={sourceOwner} onChange={(e) => setSourceOwner(e.target.value)} />
          <Button component="label" variant="outlined">{file ? file.name : "Choose PDF"}<input hidden type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Button>
          <Box><Button variant="contained" disabled={publishing || !file || !title.trim() || !category.trim()} onClick={() => void publish()}>{publishing ? "Publishing…" : "Publish document"}</Button></Box>
        </Stack>
      </CardContent></Card>}
      <Divider sx={{ mb: 3 }} />
      {loading ? <Typography aria-live="polite">Loading policy documents…</Typography> : documents.length === 0 ? <Alert severity="info">No policy documents are currently available to you.</Alert> : <Stack spacing={3}>
        {categories.map((group) => <Box key={group}>
          <Typography component="h2" variant="h5" sx={{ fontWeight: 800, mb: 1.5 }}>{group}</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
            {documents.filter((item) => item.category === group).map((item) => <Card key={item.storagePath} variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}><Chip size="small" label="Current" /><Chip size="small" variant="outlined" label={item.audience} /></Stack>
                <Typography component="h3" variant="h6" sx={{ fontWeight: 800 }}>{item.title}</Typography>
                {item.description && <Typography sx={{ mt: 1 }}>{item.description}</Typography>}
                {item.effectiveDate && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Effective/version date: {item.effectiveDate}</Typography>}
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}><Button href={item.viewUrl} target="_blank" rel="noopener noreferrer">Open PDF</Button>{canManage && <Button color="error" onClick={() => setRemoveTarget(item)}>Withdraw</Button>}</CardActions>
            </Card>)}
          </Box>
        </Box>)}
      </Stack>}
    </Container>
    <Dialog open={Boolean(removeTarget)} onClose={() => !publishing && setRemoveTarget(null)} aria-labelledby="withdraw-policy-title">
      <DialogTitle id="withdraw-policy-title">Withdraw policy document?</DialogTitle>
      <DialogContent><DialogContentText>This removes “{removeTarget?.title}” from the current catalogue. It does not define the Group's long-term records-retention policy.</DialogContentText></DialogContent>
      <DialogActions><Button disabled={publishing} onClick={() => setRemoveTarget(null)}>Cancel</Button><Button color="error" disabled={publishing} onClick={() => void withdraw()}>{publishing ? "Withdrawing…" : "Withdraw"}</Button></DialogActions>
    </Dialog>
  </Box>;
}
