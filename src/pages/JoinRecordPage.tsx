import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
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
  addContactHistoryEntry,
  convertJoinApplicationToMember,
  loadJoinApplications,
  updateJoinNotes,
  updateJoinStatus
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
  const [contactMethod, setContactMethod] = useState<ContactMethod>("phone");
  const [contactNote, setContactNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const records = await loadJoinApplications();
      const found = records.find((item) => item.id === applicationId) ?? null;
      setRecord(found);
      setNotesDraft(found?.notes ?? "");
      if (!found) setError("This joining enquiry could not be found or is outside your permitted sections.");
    } catch (loadError) {
      console.error("Unable to load joining enquiry:", loadError);
      setError("Unable to load this joining enquiry.");
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

  const changeStatus = async (status: JoinStatus) => {
    if (!record) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await updateJoinStatus(record.id, status);
      setRecord({ ...record, status });
      setMessage("Status updated.");
    } catch (statusError) {
      console.error("Unable to update Join Us status:", statusError);
      setError("Unable to update the enquiry status.");
    } finally { setSaving(false); }
  };

  const saveNotes = async () => {
    if (!record) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await updateJoinNotes(record.id, notesDraft);
      setRecord({ ...record, notes: notesDraft });
      setMessage("Leader notes saved.");
    } catch (notesError) {
      console.error("Unable to save leader notes:", notesError);
      setError("Unable to save leader notes.");
    } finally { setSaving(false); }
  };

  const addContact = async () => {
    if (!record || !contactNote.trim()) { setError("Enter a note describing the contact."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      await addContactHistoryEntry(record, contactMethod, contactNote);
      setContactNote("");
      await load();
      setMessage("Contact history updated.");
    } catch (contactError) {
      console.error("Unable to add contact history:", contactError);
      setError("Unable to add the contact-history entry.");
    } finally { setSaving(false); }
  };

  const convertToMember = async () => {
    if (!record || !window.confirm(`Create a member record for ${record.childName}?`)) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const memberId = await convertJoinApplicationToMember(record);
      setRecord({ ...record, memberId });
      setMessage("Member record created successfully.");
    } catch (conversionError) {
      console.error("Unable to convert enquiry to member:", conversionError);
      setError("Unable to create the member record. Ensure the enquiry is Accepted and has not already been converted.");
    } finally { setSaving(false); }
  };

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="lg">
      <LeaderDashboardHeader />
      <LeaderPageHeader
        title={record ? record.childName : "Join Us Enquiry"}
        description="Full joining enquiry record, workflow, notes and contact history."
        actions={<Button component={Link} to="/leader/join" variant="outlined" color="secondary">Back to enquiries</Button>}
      />

      {loading ? <Box sx={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress color="success" /></Box> : <>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
        {!record ? <Button variant="contained" color="success" onClick={() => navigate("/leader/join")}>Return to Join Us Management</Button> : <Stack spacing={3} data-testid={`join-record-page-${record.id}`}>
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
            <FormControl fullWidth><InputLabel id="join-record-status-label">Status</InputLabel><Select labelId="join-record-status-label" label="Status" value={record.status} disabled={saving} onChange={(e) => void changeStatus(e.target.value as JoinStatus)}>{statuses.map((status) => <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>)}</Select></FormControl>
            {record.status === "accepted" && !record.memberId && <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}><Button variant="contained" color="success" disabled={saving} onClick={() => void convertToMember()}>Create Member Record</Button></Box>}
            {record.memberId && <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}><Button component={Link} to={`/leader/members/${encodeURIComponent(record.memberId)}`} variant="contained" color="success">Open Member Record</Button></Box>}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Leader Notes</Typography>
            <TextField fullWidth multiline minRows={5} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Internal notes about this joining enquiry..." sx={{ mt: 2 }} />
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}><Button variant="contained" color="success" disabled={saving} onClick={() => void saveNotes()}>Save Notes</Button></Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Contact History</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "180px 1fr" }, gap: 2, mt: 2 }}>
              <FormControl><InputLabel id="join-contact-method-label">Method</InputLabel><Select labelId="join-contact-method-label" label="Method" value={contactMethod} onChange={(e) => setContactMethod(e.target.value as ContactMethod)}>{contactMethods.map((method) => <MenuItem key={method.value} value={method.value}>{method.label}</MenuItem>)}</Select></FormControl>
              <TextField label="Contact note" value={contactNote} onChange={(e) => setContactNote(e.target.value)} />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}><Button variant="contained" color="success" disabled={saving} onClick={() => void addContact()}>Add Contact</Button></Box>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: "grid", gap: 1.5 }}>
              {record.contactHistory.length === 0 ? <Typography color="text.secondary">No contact history recorded.</Typography> : [...record.contactHistory].reverse().map((entry) => <Paper key={entry.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}><Chip size="small" label={contactMethods.find((item) => item.value === entry.method)?.label ?? entry.method} /><Typography sx={{ fontWeight: 700 }}>{new Date(entry.date).toLocaleString("en-IE")}</Typography></Stack>
                <Typography sx={{ mt: 1, whiteSpace: "pre-wrap" }}>{entry.note}</Typography>
              </Paper>)}
            </Box>
          </Paper>
        </Stack>}
      </>}
    </Container>
  </Box>;
}
