import { applicationErrorMessage } from "../services/applicationErrors.ts";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import {
  convertJoinApplicationToMember,
  loadJoinApplications,
  saveJoinApplication
} from "../services/joinAdmin";
import type { ContactMethod, JoinApplicationRecord, JoinStatus } from "../services/joinAdmin";

const statuses: JoinStatus[] = ["new", "contacted", "waiting-list", "accepted", "closed"];
const contactMethods: Array<{ value: ContactMethod; label: string }> = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "text", label: "Text" },
  { value: "in-person", label: "In Person" },
  { value: "other", label: "Other" }
];

const statusLabel = (status: JoinStatus) => status === "waiting-list" ? "Waiting List" : status.charAt(0).toUpperCase() + status.slice(1);
const formatDate = (date: Date | null) => date ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Unknown";

export default function JoinRecordPage() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<JoinApplicationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<JoinStatus>("new");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("phone");
  const [contactNote, setContactNote] = useState("");
  const [pendingContacts, setPendingContacts] = useState<Array<{ id: string; method: ContactMethod; note: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [conversionConfirmationOpen, setConversionConfirmationOpen] = useState(false);
  const [leaveConfirmationOpen, setLeaveConfirmationOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const records = await loadJoinApplications();
      const found = records.find((item) => item.id === applicationId) ?? null;
      setRecord(found);
      setNotesDraft(found?.notes ?? "");
      setStatusDraft(found?.status ?? "new");
      setConversionConfirmationOpen(false);
      setPendingContacts([]);
      setContactNote("");
      if (!found) setError("This joining enquiry could not be found or is outside your permitted sections.");
    } catch (loadError) {
      setError(applicationErrorMessage(loadError, "Unable to load this joining enquiry.", "JoinRecordPage"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [applicationId]);

  const applicantDetails = useMemo(() => record ? [
    ["Child", record.childName],
    ["Date of birth", record.childDob],
    ["Section", record.section],
    ["Parent / Guardian", record.parentName],
    ["Phone", record.mobileNumber],
    ["Email", record.emailAddress],
    ["Submitted", formatDate(record.submittedAt)],
    ["Last updated", formatDate(record.updatedAt)]
  ] : [], [record]);

  const dirty = Boolean(record && (statusDraft !== record.status || notesDraft !== record.notes || pendingContacts.length > 0));

  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  const saveRecord = async () => {
    if (!record || !dirty) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await saveJoinApplication(record, statusDraft, notesDraft, pendingContacts.map(({ method, note }) => ({ method, note })));
      setRecord({ ...record, status: result.status, notes: notesDraft.trim().slice(0, 5000), contactHistory: result.contactHistory, memberId: result.memberId || record.memberId });
      setStatusDraft(result.status);
      setNotesDraft(notesDraft.trim().slice(0, 5000));
      setPendingContacts([]);
      setContactNote("");
      setMessage("Join Us enquiry saved.");
    } catch (saveError) {
      setError(applicationErrorMessage(saveError, "Unable to save the joining enquiry.", "JoinRecordPage"));
    } finally { setSaving(false); }
  };

  const stageContact = () => {
    const note = contactNote.trim().slice(0, 1500);
    if (!note) { setError("Enter a note describing the contact."); return; }
    setError("");
    setPendingContacts((current) => [...current, { id: crypto.randomUUID(), method: contactMethod, note }]);
    setContactNote("");
  };

  const convertToMember = async () => {
    if (!record) return;
    setConversionConfirmationOpen(false);
    setSaving(true); setError(""); setMessage("");
    try {
      const memberId = await convertJoinApplicationToMember(record);
      setRecord({ ...record, memberId });
      setMessage("Member record created successfully.");
    } catch (conversionError) {
      setError(applicationErrorMessage(conversionError, "Unable to create the member record. Ensure the enquiry is Accepted and has not already been converted.", "JoinRecordPage"));
    } finally { setSaving(false); }
  };

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="lg">
      <LeaderDashboardHeader />
      <LeaderPageHeader
        title={record ? record.childName : "Join Us Enquiry"}
        description="Full joining enquiry record, workflow, notes and contact history."
        actions={dirty
          ? <Button variant="outlined" color="secondary" onClick={() => setLeaveConfirmationOpen(true)}>Back to enquiries</Button>
          : <Button component={Link} to="/leader/join" variant="outlined" color="secondary">Back to enquiries</Button>}
      />

      {loading ? <Box sx={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress color="success" /></Box> : <>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
        {!record ? <Button component={Link} to="/leader/join" variant="contained" color="success">Return to Join Us Management</Button> : <Stack spacing={3} data-testid={`join-record-page-${record.id}`}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center", mb: 2 }}>
              <Chip label={statusLabel(record.status)} color={record.status === "accepted" ? "success" : record.status === "waiting-list" ? "warning" : "default"} />
              <Chip label={record.section} variant="outlined" />
              {record.memberId && <Chip label="Member Created" color="success" variant="outlined" />}
            </Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              {applicantDetails.map(([label, value]) => <Paper key={label} variant="outlined" sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{label}</Typography>
                <Typography sx={{ mt: .5, fontWeight: 700, wordBreak: "break-word" }}>{value || "Not provided"}</Typography>
              </Paper>)}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h5" color="secondary" sx={{ fontWeight: 800, mb: 2 }}>Workflow Status</Typography>
            <FormControl fullWidth><InputLabel id="join-record-status-label">Status</InputLabel><Select labelId="join-record-status-label" label="Status" value={statusDraft} disabled={saving} onChange={(e) => setStatusDraft(e.target.value as JoinStatus)}>{statuses.map((status) => <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>)}</Select></FormControl>
            {record.status === "accepted" && !record.memberId && <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}><Button variant="contained" color="success" disabled={saving} onClick={() => setConversionConfirmationOpen(true)}>Create Member Record</Button></Box>}
            {record.memberId && <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}><Button component={Link} to={`/leader/members/${encodeURIComponent(record.memberId)}`} variant="contained" color="success">Open Member Record</Button></Box>}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Leader Notes</Typography>
            <TextField fullWidth multiline minRows={5} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Internal notes about this joining enquiry..." sx={{ mt: 2 }} />
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}><Button variant="contained" color="success" disabled={saving || !dirty} onClick={() => void saveRecord()}>{saving ? "Saving…" : dirty ? "Save Changes" : "Saved"}</Button></Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Contact History</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "180px 1fr" }, gap: 2, mt: 2 }}>
              <FormControl><InputLabel id="join-contact-method-label">Method</InputLabel><Select labelId="join-contact-method-label" label="Method" value={contactMethod} onChange={(e) => setContactMethod(e.target.value as ContactMethod)}>{contactMethods.map((method) => <MenuItem key={method.value} value={method.value}>{method.label}</MenuItem>)}</Select></FormControl>
              <TextField label="Contact note" value={contactNote} onChange={(e) => setContactNote(e.target.value)} />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}><Button variant="outlined" color="success" disabled={saving || !contactNote.trim()} onClick={stageContact}>Stage Contact</Button></Box>
            {pendingContacts.length > 0 && <Alert severity="info" sx={{ mt: 2 }}>{pendingContacts.length} contact {pendingContacts.length === 1 ? "entry" : "entries"} staged. Press Save Changes to persist {pendingContacts.length === 1 ? "it" : "them"}.</Alert>}
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: "grid", gap: 1.5 }}>
              {record.contactHistory.length === 0 && pendingContacts.length === 0 && <Typography color="text.secondary">No contact history recorded.</Typography>}
              {[...pendingContacts].reverse().map((entry) => <Paper key={entry.id} variant="outlined" sx={{ p: 2, borderStyle: "dashed" }}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}><Chip size="small" color="warning" label="Pending save" /><Chip size="small" label={contactMethods.find((item) => item.value === entry.method)?.label ?? entry.method} /></Stack>
                <Typography sx={{ mt: 1, whiteSpace: "pre-wrap" }}>{entry.note}</Typography>
              </Paper>)}
              {[...record.contactHistory].reverse().map((entry) => <Paper key={entry.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}><Chip size="small" label={contactMethods.find((item) => item.value === entry.method)?.label ?? entry.method} /><Typography sx={{ fontWeight: 700 }}>{new Date(entry.date).toLocaleString("en-IE")}</Typography></Stack>
                <Typography sx={{ mt: 1, whiteSpace: "pre-wrap" }}>{entry.note}</Typography>
              </Paper>)}
            </Box>
          </Paper>
        </Stack>}
      </>}
    </Container>

    <Dialog open={leaveConfirmationOpen} onClose={() => setLeaveConfirmationOpen(false)} aria-labelledby="join-unsaved-title">
      <DialogTitle id="join-unsaved-title">Unsaved Join Us changes</DialogTitle>
      <DialogContent><Typography>You have changes that have not been saved. Leave this enquiry and discard them?</Typography></DialogContent>
      <DialogActions>
        <Button onClick={() => setLeaveConfirmationOpen(false)}>Stay</Button>
        <Button color="error" onClick={() => navigate("/leader/join")}>Leave without saving</Button>
      </DialogActions>
    </Dialog>

    <Dialog
      open={conversionConfirmationOpen && Boolean(record)}
      onClose={() => !saving && setConversionConfirmationOpen(false)}
      aria-labelledby="join-member-conversion-title"
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id="join-member-conversion-title">Create member record?</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography>
            {record ? `Create a permanent member record for ${record.childName}?` : "Create this member record?"}
          </Typography>
          <Alert severity="info">
            The new member will start as Active in {record?.section ?? "the selected section"} and this accepted enquiry will be linked to that member record.
          </Alert>
          <Typography color="text.secondary">
            The existing conversion service will re-check that the enquiry is still Accepted and has not already been converted before creating anything.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => setConversionConfirmationOpen(false)} disabled={saving}>Cancel conversion</Button>
        <Button variant="contained" color="success" onClick={() => void convertToMember()} disabled={saving}>Create Member Record</Button>
      </DialogActions>
    </Dialog>
  </Box>;
}
