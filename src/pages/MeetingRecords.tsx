import { Alert, Box, Button, Chip, Container, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { createMeetingRecord, loadMeetingRecords, updateMeetingRecord } from "../services/meetingRecords";
import type { MeetingInput, MeetingRecord, MeetingType } from "../services/meetingRecords";

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
const FULL_MEETING_HISTORY_ROLES = new Set(["Group Leader", "Group Secretary"]);

const emptyForm: MeetingInput = {
  title: "",
  meetingType: "leader",
  section: "",
  meetingDate: "",
  attendees: [],
  notes: "",
  decisions: "",
  actions: ""
};

function formatMeetingDate(value: string): string {
  if (!value) return "Date not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

export default function MeetingRecords() {
  const { adminProfile } = useAdminAuth();
  const [records, setRecords] = useState<MeetingRecord[]>([]);
  const [form, setForm] = useState<MeetingInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attendeesText, setAttendeesText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const formRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
  const hasFullMeetingHistoryAccess = Boolean(isAdmin || (adminProfile?.scoutingRole && FULL_MEETING_HISTORY_ROLES.has(adminProfile.scoutingRole)));
  const sections = useMemo(() => adminProfile?.sections ?? [], [adminProfile?.sections]);
  const availableSections = useMemo(() => isAdmin ? GROUP_SECTIONS : sections, [isAdmin, sections]);

  const refresh = useCallback(async () => {
    if (!adminProfile) return;
    setLoading(true);
    setError("");
    try {
      setRecords(await loadMeetingRecords(sections, hasFullMeetingHistoryAccess));
    } catch (loadError) {
      console.error("Unable to load meeting records:", loadError);
      setError("Unable to load meeting records for your permitted scope.");
    } finally {
      setLoading(false);
    }
  }, [adminProfile, hasFullMeetingHistoryAccess, sections]);

  useEffect(() => { void refresh(); }, [refresh]);

  const resetForm = () => {
    setEditingId(null);
    setAttendeesText("");
    setForm({ ...emptyForm, section: sections[0] ?? "" });
  };

  useEffect(() => {
    if (!form.section && sections.length) {
      setForm((current) => ({ ...current, section: sections[0] }));
    }
  }, [form.section, sections]);

  const save = async () => {
    setError("");
    setSuccess("");
    const attendees = attendeesText.split(/\n|,/).map((value) => value.trim()).filter(Boolean);
    const input: MeetingInput = { ...form, attendees, section: form.meetingType === "group" ? "Group" : form.section };
    if (!input.title.trim() || !input.meetingDate || attendees.length === 0) {
      setError("Title, meeting date and at least one attendee are required.");
      return;
    }
    if (input.meetingType === "leader" && !input.section) {
      setError("Choose the section for this leader meeting.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateMeetingRecord(editingId, input);
        setSuccess("Meeting record updated.");
      } else {
        await createMeetingRecord(input);
        setSuccess("Meeting record saved.");
      }
      resetForm();
      await refresh();
    } catch (saveError) {
      console.error("Unable to save meeting record:", saveError);
      setError("Unable to save this meeting record. Check your permissions and try again.");
    } finally {
      setSaving(false);
    }
  };

  const edit = (record: MeetingRecord) => {
    setEditingId(record.id);
    setForm({
      title: record.title,
      meetingType: record.meetingType,
      section: record.section === "Group" ? "" : record.section,
      meetingDate: record.meetingDate,
      attendees: record.attendees,
      notes: record.notes,
      decisions: record.decisions,
      actions: record.actions
    });
    setAttendeesText(record.attendees.join("\n"));
    window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const canEditRecord = (record: MeetingRecord) => isAdmin || (record.meetingType === "leader" && sections.includes(record.section));

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="xl">
      <LeaderDashboardHeader />
      <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 }, mb: 3 }}>
        <Typography variant="h4" color="secondary" sx={{ fontWeight: 800, mb: 1 }}>Meeting Records</Typography>
        <Typography color="text.secondary">Record Group Council and section leader meetings, including attendance, minutes, decisions and follow-up actions.</Typography>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper ref={formRef} data-testid="meeting-record-form" elevation={2} sx={{ p: { xs: 2.5, md: 3 }, mb: 3, scrollMarginTop: 16 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>{editingId ? "Edit meeting record" : "Record a meeting"}</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <TextField label="Meeting title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <TextField label="Meeting date and time" type="datetime-local" slotProps={{ inputLabel: { shrink: true } }} value={form.meetingDate} onChange={(event) => setForm({ ...form, meetingDate: event.target.value })} required />
          <FormControl>
            <InputLabel id="meeting-type-label">Meeting type</InputLabel>
            <Select id="meeting-type" labelId="meeting-type-label" label="Meeting type" value={form.meetingType} onChange={(event) => setForm({ ...form, meetingType: event.target.value as MeetingType, section: event.target.value === "group" ? "" : form.section })}>
              <MenuItem value="leader">Leader / Section Meeting</MenuItem>
              {isAdmin && <MenuItem value="group">Group Council Meeting</MenuItem>}
            </Select>
          </FormControl>
          {form.meetingType === "leader" && <FormControl>
            <InputLabel id="meeting-section-label">Section</InputLabel>
            <Select id="meeting-section" labelId="meeting-section-label" label="Section" value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })}>
              {availableSections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}
            </Select>
          </FormControl>}
          <TextField sx={{ gridColumn: { md: "1 / -1" } }} label="Attendees" helperText="Enter one name per line or separate names with commas." multiline minRows={3} value={attendeesText} onChange={(event) => setAttendeesText(event.target.value)} required />
          <TextField sx={{ gridColumn: { md: "1 / -1" } }} label="Notes / Minutes" multiline minRows={5} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          <TextField label="Decisions" multiline minRows={4} value={form.decisions} onChange={(event) => setForm({ ...form, decisions: event.target.value })} />
          <TextField label="Action Items" multiline minRows={4} value={form.actions} onChange={(event) => setForm({ ...form, actions: event.target.value })} />
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
          <Button variant="contained" color="success" disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : editingId ? "Update Meeting" : "Save Meeting"}</Button>
          {editingId && <Button variant="outlined" onClick={resetForm}>Cancel Edit</Button>}
        </Stack>
      </Paper>

      <Paper elevation={2} sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Meeting history</Typography>
        {loading ? <Typography color="text.secondary">Loading meeting records...</Typography> : records.length === 0 ? <Alert severity="info">No meeting records have been saved in your permitted scope yet.</Alert> : <Stack spacing={2}>
          {records.map((record) => <Paper key={record.id} variant="outlined" sx={{ p: 2.5 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}>
              <Box>
                <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{record.title}</Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
                  <Chip size="small" label={record.meetingType === "group" ? "Group Council" : "Leader Meeting"} />
                  <Chip size="small" variant="outlined" label={record.section} />
                  <Chip size="small" variant="outlined" label={formatMeetingDate(record.meetingDate)} />
                </Stack>
              </Box>
              {canEditRecord(record) && <Button variant="outlined" onClick={() => edit(record)}>Edit</Button>}
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2">Attendees</Typography>
            <Typography color="text.secondary" sx={{ mb: 1.5 }}>{record.attendees.join(", ")}</Typography>
            {record.notes && <><Typography variant="subtitle2">Minutes</Typography><Typography sx={{ whiteSpace: "pre-wrap", mb: 1.5 }}>{record.notes}</Typography></>}
            {record.decisions && <><Typography variant="subtitle2">Decisions</Typography><Typography sx={{ whiteSpace: "pre-wrap", mb: 1.5 }}>{record.decisions}</Typography></>}
            {record.actions && <><Typography variant="subtitle2">Actions</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{record.actions}</Typography></>}
          </Paper>)}
        </Stack>}
      </Paper>
    </Container>
  </Box>;
}
