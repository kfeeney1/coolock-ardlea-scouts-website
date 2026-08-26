import { Alert, Box, Button, Chip, Container, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { isSupportedMeetingImportFile, parseMeetingDocument } from "../services/meetingRecordImport";
import { createMeetingRecord, loadMeetingRecordVersions, loadMeetingRecords, updateMeetingRecord } from "../services/meetingRecords";
import type { MeetingInput, MeetingRecord, MeetingRecordVersion, MeetingType } from "../services/meetingRecords";

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
const FULL_MEETING_HISTORY_ROLES = new Set(["Group Leader", "Group Secretary"]);
const MAX_IMPORT_BYTES = 500_000;

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

function formatVersionDate(value: Date | null): string {
  return value ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(value) : "Timestamp pending";
}

function meetingTypeLabel(type: MeetingType): string {
  if (type === "group") return "Group Council";
  if (type === "group-leaders") return "Group Leaders Meeting";
  return "Leader Meeting";
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
  const [importMessage, setImportMessage] = useState("");
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [versionsByMeeting, setVersionsByMeeting] = useState<Record<string, MeetingRecordVersion[]>>({});
  const [versionLoadingId, setVersionLoadingId] = useState<string | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
  const isGroupOfficer = Boolean(adminProfile?.scoutingRole && FULL_MEETING_HISTORY_ROLES.has(adminProfile.scoutingRole));
  const hasFullMeetingHistoryAccess = Boolean(isAdmin || isGroupOfficer);
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
    setImportMessage("");
    setImportWarnings([]);
    setForm({ ...emptyForm, section: sections[0] ?? "" });
  };

  useEffect(() => {
    if (!form.section && sections.length && form.meetingType === "leader") {
      setForm((current) => ({ ...current, section: sections[0] }));
    }
  }, [form.meetingType, form.section, sections]);

  const importDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setSuccess("");
    setImportMessage("");
    setImportWarnings([]);

    if (!isSupportedMeetingImportFile(file.name, file.type)) {
      setError("This file type cannot be read safely in the browser. Export Word or PDF minutes as .txt, .md or .html and upload that file instead.");
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setError("The meeting document is too large. Upload a text export smaller than 500 KB.");
      return;
    }

    try {
      const imported = parseMeetingDocument(await file.text());
      const warnings = [...imported.warnings];
      let meetingType = imported.meetingType;
      if (!isAdmin && meetingType !== "leader") {
        meetingType = "leader";
        warnings.push("This account cannot create Group Council or Group Leaders records, so the imported draft was changed to a section leader meeting.");
      }

      let section = meetingType === "leader" ? imported.section : "";
      if (meetingType === "leader" && (!section || !availableSections.includes(section))) {
        if (imported.section && !availableSections.includes(imported.section)) warnings.push(`The imported section ${imported.section} is outside your permitted sections.`);
        section = availableSections[0] ?? "";
      }

      setEditingId(null);
      setForm({
        title: imported.title,
        meetingType,
        section,
        meetingDate: imported.meetingDate,
        attendees: imported.attendees,
        notes: imported.notes,
        decisions: imported.decisions,
        actions: imported.actions
      });
      setAttendeesText(imported.attendees.join("\n"));
      setImportMessage(`Imported draft from ${file.name}. Review every field below before saving.`);
      setImportWarnings(warnings);
      window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (importError) {
      console.error("Unable to import meeting document:", importError);
      setError("Unable to read this meeting document. Check that it is a valid text, Markdown or HTML export and try again.");
    }
  };

  const save = async () => {
    setError("");
    setSuccess("");
    const attendees = attendeesText.split(/\n|,/).map((value) => value.trim()).filter(Boolean);
    const section = form.meetingType === "leader" ? form.section : form.meetingType === "group-leaders" ? "Group Leaders" : "Group";
    const input: MeetingInput = { ...form, attendees, section };
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
        setVersionsByMeeting((current) => {
          const next = { ...current };
          delete next[editingId];
          return next;
        });
        setSuccess("Meeting record updated. The previous version has been retained in the audit history.");
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
    setImportMessage("");
    setImportWarnings([]);
    setForm({
      title: record.title,
      meetingType: record.meetingType,
      section: record.meetingType === "leader" ? record.section : "",
      meetingDate: record.meetingDate,
      attendees: record.attendees,
      notes: record.notes,
      decisions: record.decisions,
      actions: record.actions
    });
    setAttendeesText(record.attendees.join("\n"));
    window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const canEditRecord = (record: MeetingRecord) => {
    if (record.meetingType === "group" || record.meetingType === "group-leaders") return isAdmin;
    return Boolean(isAdmin || sections.includes(record.section));
  };

  const toggleVersions = async (record: MeetingRecord) => {
    if (expandedVersionId === record.id) {
      setExpandedVersionId(null);
      return;
    }
    setExpandedVersionId(record.id);
    if (versionsByMeeting[record.id]) return;
    setVersionLoadingId(record.id);
    try {
      const versions = await loadMeetingRecordVersions(record.id);
      setVersionsByMeeting((current) => ({ ...current, [record.id]: versions }));
    } catch (loadError) {
      console.error("Unable to load meeting record versions:", loadError);
      setError("Unable to load the version history for this meeting.");
    } finally {
      setVersionLoadingId(null);
    }
  };

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="xl">
      <LeaderDashboardHeader />
      <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 }, mb: 3 }}>
        <Typography variant="h4" color="secondary" sx={{ fontWeight: 800, mb: 1 }}>Meeting Records</Typography>
        <Typography color="text.secondary">Record Group Council, Group Leaders and section leader meetings, including attendance, minutes, decisions and follow-up actions.</Typography>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Import a meeting document</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>Upload a text, Markdown or HTML export of meeting minutes. The document is read only in your browser and converted into an editable draft; nothing is saved until you review the fields and press Save Meeting.</Typography>
        <Button variant="outlined" component="label">
          Choose meeting document
          <input hidden type="file" accept=".txt,.md,.html,.htm,text/plain,text/markdown,text/html" onChange={(event) => void importDocument(event)} />
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>For Word or PDF minutes, export or save a copy as text/HTML first. Recommended headings: Title, Meeting Type, Section, Date, Attendees, Minutes, Decisions and Action Items.</Typography>
      </Paper>

      <Paper ref={formRef} data-testid="meeting-record-form" elevation={2} sx={{ p: { xs: 2.5, md: 3 }, mb: 3, scrollMarginTop: 16 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>{editingId ? "Edit meeting record" : "Record a meeting"}</Typography>
        {importMessage && <Alert severity="success" sx={{ mb: 2 }}>{importMessage}</Alert>}
        {importWarnings.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}><Typography sx={{ fontWeight: 700, mb: 0.5 }}>Check the imported draft</Typography>{importWarnings.map((warning) => <Typography key={warning} variant="body2">• {warning}</Typography>)}</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <TextField label="Meeting title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <TextField label="Meeting date and time" type="datetime-local" slotProps={{ inputLabel: { shrink: true } }} value={form.meetingDate} onChange={(event) => setForm({ ...form, meetingDate: event.target.value })} required />
          <FormControl>
            <InputLabel id="meeting-type-label">Meeting type</InputLabel>
            <Select id="meeting-type" labelId="meeting-type-label" label="Meeting type" value={form.meetingType} onChange={(event) => setForm({ ...form, meetingType: event.target.value as MeetingType, section: event.target.value === "leader" ? form.section : "" })}>
              <MenuItem value="leader">Leader / Section Meeting</MenuItem>
              {isAdmin && <MenuItem value="group-leaders">Group Leaders Meeting</MenuItem>}
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
          {records.map((record) => <Paper key={record.id} variant="outlined" sx={{ p: 2.5 }} data-testid={`meeting-record-${record.id}`}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" } }}>
              <Box>
                <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{record.title}</Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
                  <Chip size="small" label={meetingTypeLabel(record.meetingType)} />
                  <Chip size="small" variant="outlined" label={record.section} />
                  <Chip size="small" variant="outlined" label={formatMeetingDate(record.meetingDate)} />
                </Stack>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                {isAdmin && <Button variant="text" onClick={() => void toggleVersions(record)}>{expandedVersionId === record.id ? "Hide Version History" : "Version History"}</Button>}
                {canEditRecord(record) && <Button variant="outlined" onClick={() => edit(record)}>Edit</Button>}
              </Stack>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2">Attendees</Typography>
            <Typography color="text.secondary" sx={{ mb: 1.5 }}>{record.attendees.join(", ")}</Typography>
            {record.notes && <><Typography variant="subtitle2">Minutes</Typography><Typography sx={{ whiteSpace: "pre-wrap", mb: 1.5 }}>{record.notes}</Typography></>}
            {record.decisions && <><Typography variant="subtitle2">Decisions</Typography><Typography sx={{ whiteSpace: "pre-wrap", mb: 1.5 }}>{record.decisions}</Typography></>}
            {record.actions && <><Typography variant="subtitle2">Actions</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{record.actions}</Typography></>}

            {isAdmin && expandedVersionId === record.id && <Box sx={{ mt: 2 }} data-testid={`meeting-version-history-${record.id}`}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>Previous versions</Typography>
              {versionLoadingId === record.id ? <Typography color="text.secondary">Loading version history...</Typography> : (versionsByMeeting[record.id]?.length ?? 0) === 0 ? <Alert severity="info">No previous versions have been recorded yet.</Alert> : <Stack spacing={1.5}>
                {versionsByMeeting[record.id].map((version, index) => <Paper key={version.id} variant="outlined" sx={{ p: 2 }}>
                  <Typography sx={{ fontWeight: 800 }}>Previous version {versionsByMeeting[record.id].length - index}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Saved before an edit · {formatVersionDate(version.versionedAt)}</Typography>
                  <Typography variant="subtitle2">Title</Typography>
                  <Typography sx={{ mb: 1 }}>{version.title}</Typography>
                  <Typography variant="subtitle2">Attendees</Typography>
                  <Typography sx={{ mb: 1 }}>{version.attendees.join(", ")}</Typography>
                  {version.notes && <><Typography variant="subtitle2">Minutes</Typography><Typography sx={{ whiteSpace: "pre-wrap", mb: 1 }}>{version.notes}</Typography></>}
                  {version.decisions && <><Typography variant="subtitle2">Decisions</Typography><Typography sx={{ whiteSpace: "pre-wrap", mb: 1 }}>{version.decisions}</Typography></>}
                  {version.actions && <><Typography variant="subtitle2">Actions</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{version.actions}</Typography></>}
                </Paper>)}
              </Stack>}
            </Box>}
          </Paper>)}
        </Stack>}
      </Paper>
    </Container>
  </Box>;
}
