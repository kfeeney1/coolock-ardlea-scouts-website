import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { watchMeetingRecordsExperience } from "../services/meetingRecordsExperienceSettings";
import { meetingReportAccess } from "../security/meetingReportAccess";
import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Container, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import MeetingRecordImportReview from "../components/MeetingRecordImportReview";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { isGroupLeadershipAppointment } from "../security/scoutingAppointments";
import { extractMeetingCandidates, type MeetingCandidate, type MeetingCandidateKey } from "../services/meetingRecordImport";
import { isParseableMeetingDocument, readMeetingDocument } from "../services/meetingDocumentReader";
import { createMeetingRecord, loadMeetingRecordVersions, loadMeetingRecords, updateMeetingRecord } from "../services/meetingRecords";
import MeetingRecordsHistory from "../components/MeetingRecordsHistory";
import type { MeetingInput, MeetingRecord, MeetingRecordVersion, MeetingType } from "../services/meetingRecords";

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
const FULL_MEETING_HISTORY_ROLES = new Set(["Group Secretary"]);

const emptyForm: MeetingInput = {
  title: "",
  meetingType: "leader",
  section: "",
  meetingDate: "",
  attendees: [],
  notes: "",
  decisions: "",
  actions: "",
  attachment: null
};

export default function MeetingRecords() {
  const { adminProfile } = useAdminAuth();
  const [searchParams] = useSearchParams();
  const navigationView = searchParams.get("view");
  const pageIdentity = navigationView === "secretary" ? "secretary-meeting-records" : navigationView === "group-operations" ? "group-meeting-records" : "meeting-records";
  const [redesigned, setRedesigned] = useState(false);
  const [awaitingReview, setAwaitingReview] = useState(false);
  const [importExpanded, setImportExpanded] = useState(false);
  useEffect(() => watchMeetingRecordsExperience(
    (version) => setRedesigned(version === "redesigned"),
    () => setRedesigned(false)
  ), []);
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
  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);
  const [parseBusy, setParseBusy] = useState(false);
  const [parseCandidates, setParseCandidates] = useState<MeetingCandidate[]>([]);
  const [acceptedCandidates, setAcceptedCandidates] = useState<Set<MeetingCandidateKey>>(new Set());
  const [versionsByMeeting, setVersionsByMeeting] = useState<Record<string, MeetingRecordVersion[]>>({});
  const [versionLoadingId, setVersionLoadingId] = useState<string | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
  const isGroupOfficer = Boolean(isGroupLeadershipAppointment(adminProfile?.scoutingRole) || (adminProfile?.scoutingRole && FULL_MEETING_HISTORY_ROLES.has(adminProfile.scoutingRole)));
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
      setError(applicationErrorMessage(loadError, "Unable to load meeting records for your permitted scope.", "MeetingRecords"));
    } finally {
      setLoading(false);
    }
  }, [adminProfile, hasFullMeetingHistoryAccess, sections]);

  useEffect(() => { void refresh(); }, [refresh]);

  const resetForm = () => {
    setEditingId(null);
    setImportExpanded(false);
    setAttendeesText("");
    setImportMessage("");
    setImportWarnings([]);
    setSelectedDocument(null);
    setAwaitingReview(false);
    setParseCandidates([]);
    setAcceptedCandidates(new Set());
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
    setAwaitingReview(false);
    setParseCandidates([]);
    setAcceptedCandidates(new Set());
    setSelectedDocument(file);
    setImportExpanded(true);

    if (!isParseableMeetingDocument(file.name, file.type)) {
      setImportMessage(`Selected ${file.name}. It will remain attached; enter the meeting details manually.`);
      return;
    }

    setParseBusy(true);
    try {
      const extracted = await readMeetingDocument(file);
      const mapped = extractMeetingCandidates(extracted.text);
      setParseCandidates(mapped.candidates);
      setAwaitingReview(mapped.candidates.length > 0);
      setImportWarnings([...extracted.warnings, ...mapped.warnings]);
      setImportMessage(mapped.candidates.length
        ? `Parsed ${file.name}. Review the proposed values below; nothing has been applied or saved.`
        : `No recognisable meeting information was found in ${file.name}. You can continue manually.`);
      if (!redesigned) window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (importError) {
      setImportMessage(`Selected ${file.name}. The original file can still be attached when the meeting is saved.`);
      setError(applicationErrorMessage(importError, "Unable to parse this meeting document. Enter the meeting details manually.", "MeetingRecords"));
    } finally {
      setParseBusy(false);
    }
  };

  const currentCandidateValue = (key: MeetingCandidateKey): string => {
    if (key === "attendees") return attendeesText;
    const value = form[key];
    return Array.isArray(value) ? value.join("\n") : String(value ?? "");
  };

  const proposedCandidateValue = (candidate: MeetingCandidate): string =>
    Array.isArray(candidate.proposed) ? candidate.proposed.join("\n") : candidate.proposed;

  const updateCandidate = (key: MeetingCandidateKey, value: string) => {
    setParseCandidates((current) => current.map((candidate) => candidate.key === key
      ? { ...candidate, proposed: key === "attendees" ? value.split(/\n|,/).map((item) => item.trim()).filter(Boolean) : value }
      : candidate));
  };

  const applyCandidates = () => {
    if (acceptedCandidates.size === 0) return;
    const next = { ...form };
    let nextAttendees = attendeesText;
    for (const candidate of parseCandidates) {
      if (!acceptedCandidates.has(candidate.key)) continue;
      if (candidate.key === "attendees") {
        next.attendees = Array.isArray(candidate.proposed) ? candidate.proposed : candidate.proposed.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
        nextAttendees = next.attendees.join("\n");
      } else if (candidate.key === "meetingType") {
        next.meetingType = candidate.proposed as MeetingType;
      } else {
        (next as unknown as Record<string, unknown>)[candidate.key] = candidate.proposed;
      }
    }
    if (next.meetingType !== "leader") next.section = "";
    else if (next.section && !availableSections.includes(next.section)) {
      setImportWarnings((warnings) => [...warnings, `The proposed section ${next.section} is outside your permitted sections and was not applied.`]);
      next.section = form.section;
    }
    setAwaitingReview(false);
    setForm(next);
    setAttendeesText(nextAttendees);
    setAcceptedCandidates(new Set());
    setImportMessage("Selected document values applied to the editable meeting form. Review them before saving.");
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
        await updateMeetingRecord(editingId, input, selectedDocument);
        setExpandedVersionId((current) => current === editingId ? null : current);
        setVersionsByMeeting((current) => {
          const next = { ...current };
          delete next[editingId];
          return next;
        });
        setSuccess("Meeting record updated. The previous version has been retained in the audit history.");
      } else {
        await createMeetingRecord(input, selectedDocument);
        setSuccess("Meeting record saved.");
      }
      resetForm();
      void refresh();
    } catch (saveError) {
      setError(applicationErrorMessage(saveError, "Unable to save this meeting record. Check your permissions and try again.", "MeetingRecords"));
    } finally {
      setSaving(false);
    }
  };

  const edit = (record: MeetingRecord) => {
    resetForm();
    setEditingId(record.id);
    setForm({
      title: record.title,
      meetingType: record.meetingType,
      section: record.meetingType === "leader" ? record.section : "",
      meetingDate: record.meetingDate,
      attendees: record.attendees,
      notes: record.notes,
      decisions: record.decisions,
      actions: record.actions,
      attachment: record.attachment
    });
    setAttendeesText(record.attendees.join("\n"));
    window.requestAnimationFrame(() => {
      titleRef.current?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "start"
      });
    });
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
      setError(applicationErrorMessage(loadError, "Unable to load the version history for this meeting.", "MeetingRecords"));
    } finally {
      setVersionLoadingId(null);
    }
  };

  const documentPicker = <Box sx={{ overflowWrap: "anywhere" }}>
        <Typography color="text.secondary" sx={{ mb: 2 }}>Choose a PDF, DOC, DOCX, ODT or text meeting document. Supported files are parsed locally into proposed values; nothing is applied or saved until you explicitly review it.</Typography>
        <Button variant="outlined" component="label" sx={{ minHeight: 44, "&:focus-within": { outline: "2px solid currentColor", outlineOffset: 2 } }}>
          Choose meeting document
          <input aria-label="Choose meeting document" style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} type="file" accept=".pdf,.doc,.docx,.odt,.txt,.md,.html,.htm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,text/plain,text/markdown,text/html" disabled={parseBusy || saving} onChange={(event) => void importDocument(event)} />
        </Button>
        {selectedDocument && <Chip sx={{ mt: 1, maxWidth: "100%", minHeight: 44, height: "auto", "& .MuiChip-label": { whiteSpace: "normal", overflowWrap: "anywhere" } }} label={selectedDocument.name} onDelete={parseBusy || saving ? undefined : () => { setImportMessage(""); setImportWarnings([]); setSelectedDocument(null); setAwaitingReview(false); setParseCandidates([]); setAcceptedCandidates(new Set()); }} />}
        <Typography role="status" variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>{parseBusy ? "Parsing document…" : "The original document remains the source attachment. Parsed values are only suggestions."}</Typography>
  </Box>;
  const importReview = (
        <MeetingRecordImportReview
          compact={redesigned}
          message={importMessage}
          warnings={importWarnings}
          candidates={parseCandidates}
          acceptedCandidates={acceptedCandidates}
          currentCandidateValue={currentCandidateValue}
          proposedCandidateValue={proposedCandidateValue}
          onCandidateChange={updateCandidate}
          onToggleCandidate={(key) => setAcceptedCandidates((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
          })}
          onApplyCandidates={applyCandidates}
        />
  );

  return <Box data-testid={`page-${pageIdentity}`} sx={{ minHeight: "100vh", backgroundColor: "background.default", py: redesigned ? { xs: 2, md: 3 } : { xs: 4, md: 6 } }}>
    <Container maxWidth="xl">
      <LeaderDashboardHeader />
      <Paper elevation={redesigned ? 0 : 2} variant={redesigned ? "outlined" : "elevation"} sx={{ p: redesigned ? 2 : { xs: 2.5, md: 4 }, mb: 2 }}>
        <Typography component="h1" variant={redesigned ? "h5" : "h4"} color="secondary" sx={{ fontWeight: 800, mb: 1 }}>Meeting Records</Typography>
        {meetingReportAccess(adminProfile).canOpen && <Button component={Link} to="/leader/reports/meetings" variant="outlined" sx={{ minHeight: 44, mb: 2 }}>Open Meeting Records Report</Button>}
        {!redesigned && <Typography color="text.secondary">Record Group Council, Group Leaders and section leader meetings, including attendance, minutes, decisions and follow-up actions.</Typography>}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {!redesigned && <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Import a meeting document</Typography>
        {documentPicker}
      </Paper>}

      <Box data-testid="meeting-record-layout" data-layout={redesigned ? "redesigned" : "existing"} sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", md: redesigned ? "minmax(0, 6fr) minmax(0, 5fr)" : "minmax(0, 1fr)" },
        gap: 3,
        alignItems: "start"
      }}>
      <Paper ref={formRef} data-testid="meeting-record-form" variant={redesigned ? "outlined" : "elevation"} elevation={redesigned ? 0 : 2} sx={{ minWidth: 0, p: { xs: 2, md: 3 }, scrollMarginTop: 16 }}>
        <Typography component="h2" variant="h6" sx={{ fontWeight: 800, mb: 2 }}>{editingId ? "Edit meeting record" : "Record a meeting"}</Typography>
        {redesigned ? <Accordion disableGutters variant="outlined" expanded={importExpanded || parseBusy || awaitingReview}
          onChange={(_, expanded) => setImportExpanded(expanded)} sx={{ mb: 2 }}>
          <AccordionSummary id="meeting-import-heading" aria-controls="meeting-import-panel" expandIcon={<ExpandMoreIcon />}
            sx={{ minHeight: 44, fontWeight: 700 }}>Import a meeting document</AccordionSummary>
          <AccordionDetails sx={{ overflowWrap: "anywhere" }}>
            {documentPicker}
            {importReview}
          </AccordionDetails>
        </Accordion> : importReview}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
          <TextField inputRef={titleRef} label="Meeting title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
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
          <TextField sx={{ gridColumn: "1 / -1" }} label="Attendees" helperText="Enter one name per line or separate names with commas." multiline minRows={3} value={attendeesText} onChange={(event) => setAttendeesText(event.target.value)} required />
          <TextField sx={{ gridColumn: "1 / -1" }} label="Notes / Minutes" multiline minRows={5} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          <TextField label="Decisions" multiline minRows={4} value={form.decisions} onChange={(event) => setForm({ ...form, decisions: event.target.value })} />
          <TextField label="Action Items" multiline minRows={4} value={form.actions} onChange={(event) => setForm({ ...form, actions: event.target.value })} />
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
          <Button variant="contained" color={redesigned ? "primary" : "success"} sx={{ minHeight: 44 }} disabled={saving || parseBusy} onClick={() => void save()}>{saving ? "Saving..." : editingId ? "Update Meeting" : "Save Meeting"}</Button>
          {editingId && <Button variant="outlined" disabled={saving || parseBusy} sx={{ minHeight: 44 }} onClick={resetForm}>Cancel Edit</Button>}
        </Stack>
      </Paper>

        <MeetingRecordsHistory
          redesigned={redesigned}
          records={records}
          loading={loading}
          isAdmin={isAdmin}
          editDisabled={saving || parseBusy}
          canEditRecord={canEditRecord}
          onEdit={edit}
          onToggleVersions={(record) => void toggleVersions(record)}
          expandedVersionId={expandedVersionId}
          versionLoadingId={versionLoadingId}
          versionsByMeeting={versionsByMeeting}
        />
      </Box>
    </Container>
  </Box>;
}
