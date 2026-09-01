import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Alert, Box, Button, Chip, CircularProgress, Container, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { loadMemberConsentSummaries, loadMemberLifecycleHistory, loadMembers, updateMember, type MemberConsentSummary, type MemberLifecycleHistoryRecord, type MemberRecord, type MemberStatus } from "../services/memberAdmin";
import { lifecycleChangeLabel } from "../services/memberLifecycleLogic";

const sections = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group", "Other"];
const statuses: MemberStatus[] = ["active", "inactive", "left"];
const statusLabel = (status: MemberStatus) => status === "active" ? "Active" : status === "inactive" ? "Inactive" : "Left";
const formatDate = (value: Date | null) => value ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(value) : "Date unavailable";

export default function MemberRecordPage() {
  const { memberId = "" } = useParams();
  const [member, setMember] = useState<MemberRecord | null>(null);
  const [draft, setDraft] = useState<MemberRecord | null>(null);
  const [history, setHistory] = useState<MemberLifecycleHistoryRecord[]>([]);
  const [consents, setConsents] = useState<MemberConsentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const found = (await loadMembers()).find((item) => item.id === memberId) ?? null;
      if (!found) {
        setMember(null);
        setDraft(null);
        setError("This member record is unavailable or outside your assigned sections.");
        return;
      }
      setMember(found);
      setDraft({ ...found });
      const [loadedHistory, loadedConsents] = await Promise.all([
        loadMemberLifecycleHistory(found.id),
        loadMemberConsentSummaries(found)
      ]);
      setHistory(loadedHistory);
      setConsents(loadedConsents);
    } catch (loadError) {
      console.error("Unable to load member record:", loadError);
      setError("Unable to load this member record.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [memberId]);

  const save = async () => {
    if (!member || !draft) return;
    if (!draft.displayName.trim()) return setError("Member name is required.");
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateMember(member.id, {
        firstName: draft.firstName, lastName: draft.lastName, displayName: draft.displayName,
        dateOfBirth: draft.dateOfBirth, section: draft.section, parentName: draft.parentName,
        emailAddress: draft.emailAddress, mobileNumber: draft.mobileNumber,
        emergencyContactName: draft.emergencyContactName, emergencyContactPhone: draft.emergencyContactPhone,
        status: draft.status
      });
      setMember({ ...draft });
      setHistory(await loadMemberLifecycleHistory(member.id));
      setMessage("Member details updated.");
    } catch (saveError) {
      console.error("Unable to save member:", saveError);
      setError("Unable to update the member record.");
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof MemberRecord, label: string, type = "text") => draft && (
    <TextField label={label} type={type} value={String(draft[key] ?? "")} slotProps={type === "date" ? { inputLabel: { shrink: true } } : undefined} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
  );

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="xl">
      <LeaderDashboardHeader />
      <Button component={Link} to="/leader/members" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>Back to Member Management</Button>
      <LeaderPageHeader title={member?.displayName || "Member Record"} description="Member details, consent indicators and membership history in one record." />
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
      {loading ? <Box sx={{ minHeight: 300, display: "grid", placeItems: "center" }}><CircularProgress color="success" /></Box> : draft && <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center", mb: 3 }}>
            <Typography variant="h4" color="secondary" sx={{ fontWeight: 800 }}>Member Details</Typography>
            <Chip label={statusLabel(draft.status)} color={draft.status === "active" ? "success" : draft.status === "inactive" ? "warning" : "default"} />
            {draft.section && <Chip label={draft.section} variant="outlined" />}
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            {field("firstName", "First name")}{field("lastName", "Last name")}{field("displayName", "Display name")}{field("dateOfBirth", "Date of birth", "date")}
            <FormControl><InputLabel>Section</InputLabel><Select label="Section" value={draft.section} onChange={(event) => setDraft({ ...draft, section: event.target.value })}>{sections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}</Select></FormControl>
            <FormControl><InputLabel>Status</InputLabel><Select label="Status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as MemberStatus })}>{statuses.map((status) => <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>)}</Select></FormControl>
            {field("parentName", "Parent / Guardian")}{field("emailAddress", "Email address", "email")}{field("mobileNumber", "Mobile number")}{field("emergencyContactName", "Emergency contact")}{field("emergencyContactPhone", "Emergency contact phone")}
          </Box>
          <Button variant="contained" color="success" disabled={saving} onClick={() => void save()} sx={{ mt: 3 }}>{saving ? "Saving…" : "Save Member"}</Button>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h4" color="secondary" sx={{ fontWeight: 800, mb: 2 }}>Consent & Medical Indicators</Typography>
          {consents.length === 0 ? <Alert severity="info">No linked consent records were found for this member.</Alert> : <Stack spacing={1.5}>{consents.map((consent) => <Paper key={consent.consentId} variant="outlined" sx={{ p: 2 }}><Typography sx={{ fontWeight: 800 }}>{consent.consentTo || "General consent"}</Typography><Typography color="text.secondary">Submitted {formatDate(consent.submittedAt)}</Typography><Stack direction="row" spacing={1} sx={{ mt: 1 }}><Chip size="small" label={consent.hasMedicalAlert ? "Medical information recorded" : "No medical alert"} color={consent.hasMedicalAlert ? "warning" : "default"} /><Chip size="small" label={consent.hasMedicationManagement ? "Medication management" : "No medication management"} color={consent.hasMedicationManagement ? "warning" : "default"} /></Stack></Paper>)}</Stack>}
        </Paper>

        <Paper variant="outlined" sx={{ p: 3 }} data-testid="member-history-detail">
          <Typography variant="h4" color="secondary" sx={{ fontWeight: 800, mb: 1 }}>Member History</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Section transfers and membership status changes are append-only and remain with this member.</Typography>
          {history.length === 0 ? <Alert severity="info">No section transfers or membership status changes have been recorded yet.</Alert> : <Stack spacing={1.5}>{history.map((entry) => <Paper key={entry.id} variant="outlined" sx={{ p: 2 }}><Typography sx={{ fontWeight: 800 }}>{lifecycleChangeLabel(entry.changeType)}</Typography><Typography color="text.secondary" sx={{ mt: 0.5 }}>{entry.fromSection || "No section"} / {entry.fromStatus} → {entry.toSection || "No section"} / {entry.toStatus}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{formatDate(entry.changedAt)}</Typography></Paper>)}</Stack>}
        </Paper>
      </Stack>}
    </Container>
  </Box>;
}
