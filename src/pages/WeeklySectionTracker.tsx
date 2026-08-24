import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadAttendanceInsightMembers } from "../services/reporting";
import type { AttendanceInsightMember } from "../services/attendanceInsightsLogic";
import {
  copyWeeklyMeeting,
  createWeeklyMeeting,
  DEFAULT_MEETING_LOCATION,
  loadWeeklyMeetings,
  updateWeeklyMeeting
} from "../services/weeklyTracker";
import type { WeeklyMedicalIssue, WeeklyMeetingInput, WeeklyMeetingRecord, WeeklyMemberEntry } from "../services/weeklyTracker";
import { newWeeklyEntry } from "../services/weeklyTrackerLogic";

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
const today = new Date().toISOString().slice(0, 10);
type MeetingStep = "attendance" | "badgework" | "medical" | "notes";

function listFromText(value: string): string[] {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function displayDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(parsed);
}

export default function WeeklySectionTracker() {
  const { adminProfile } = useAdminAuth();
  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
  const isGroupLeader = adminProfile?.scoutingRole === "Group Leader";
  const canManageAllSections = Boolean(isAdmin || isGroupLeader);
  const availableSections = useMemo(() => canManageAllSections ? GROUP_SECTIONS : adminProfile?.sections ?? [], [adminProfile?.sections, canManageAllSections]);

  const [members, setMembers] = useState<AttendanceInsightMember[]>([]);
  const [records, setRecords] = useState<WeeklyMeetingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<WeeklyMeetingRecord | null>(null);
  const [step, setStep] = useState<MeetingStep>("attendance");

  const [createSection, setCreateSection] = useState("");
  const [createDate, setCreateDate] = useState(today);
  const [createLocation, setCreateLocation] = useState(DEFAULT_MEETING_LOCATION);
  const [createActivities, setCreateActivities] = useState("");
  const [createBadgework, setCreateBadgework] = useState("");
  const [medicalMemberId, setMedicalMemberId] = useState("");
  const [medicalDetails, setMedicalDetails] = useState("");
  const [medicalAction, setMedicalAction] = useState("");
  const [copyDates, setCopyDates] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!createSection && availableSections.length > 0) setCreateSection(availableSections[0]);
  }, [availableSections, createSection]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [loadedMembers, loadedRecords] = await Promise.all([
        loadAttendanceInsightMembers({ isAdmin: Boolean(isAdmin), sections: canManageAllSections ? GROUP_SECTIONS : adminProfile?.sections ?? [] }),
        loadWeeklyMeetings(adminProfile?.sections ?? [], canManageAllSections)
      ]);
      setMembers(loadedMembers.filter((member) => member.status === "active"));
      setRecords(loadedRecords);
    } catch (loadError) {
      console.error("Unable to load weekly tracker:", loadError);
      setError("Unable to load weekly meetings for your permitted sections.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [adminProfile?.sections, canManageAllSections, isAdmin]);

  const rosterEntries = (section: string): WeeklyMemberEntry[] => members
    .filter((member) => member.section === section)
    .map((member) => newWeeklyEntry(member.id, member.displayName))
    .sort((a, b) => a.memberName.localeCompare(b.memberName));

  const updateDraftEntry = (memberId: string, patch: Partial<WeeklyMemberEntry>) => {
    setDraft((current) => current ? { ...current, entries: current.entries.map((entry) => entry.memberId === memberId ? { ...entry, ...patch } : entry) } : current);
  };

  const createMeeting = async () => {
    setError("");
    setSuccess("");
    if (!createSection || !createDate) return setError("Choose a section and meeting date.");
    setSaving(true);
    try {
      const input: WeeklyMeetingInput = {
        section: createSection,
        meetingDate: createDate,
        location: createLocation || DEFAULT_MEETING_LOCATION,
        status: createDate > today ? "planned" : "open",
        plannedActivities: listFromText(createActivities),
        plannedBadgework: listFromText(createBadgework),
        medicalIssues: [],
        notes: "",
        entries: rosterEntries(createSection)
      };
      const id = await createWeeklyMeeting(input);
      setDraft({ id, ...input });
      setCreating(false);
      setStep("attendance");
      setSuccess("Meeting created. Track attendance when the meeting starts.");
      await refresh();
    } catch (saveError) {
      console.error("Unable to create weekly meeting:", saveError);
      setError("Unable to create this meeting. Check your permissions and try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async (message = "Meeting progress saved.") => {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      await updateWeeklyMeeting(draft.id, { ...draft, status: draft.status === "planned" && draft.meetingDate <= today ? "open" : draft.status });
      setDraft((current) => current ? { ...current, status: current.status === "planned" && current.meetingDate <= today ? "open" : current.status } : current);
      setSuccess(message);
      await refresh();
    } catch (saveError) {
      console.error("Unable to save weekly meeting:", saveError);
      setError("Unable to save this meeting. Check your permissions and try again.");
    } finally {
      setSaving(false);
    }
  };

  const closeMeeting = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const completedEntries = draft.entries.map((entry) => ({ ...entry, attendance: entry.attendance === "present" ? "present" as const : "absent" as const }));
      await updateWeeklyMeeting(draft.id, { ...draft, status: "closed", entries: completedEntries });
      setDraft(null);
      setSuccess("Meeting closed and added to meeting history.");
      await refresh();
    } catch (saveError) {
      console.error("Unable to close weekly meeting:", saveError);
      setError("Unable to close this meeting.");
    } finally {
      setSaving(false);
    }
  };

  const addMedicalIssue = () => {
    if (!draft || !medicalMemberId || !medicalDetails.trim()) return;
    const member = draft.entries.find((entry) => entry.memberId === medicalMemberId);
    if (!member) return;
    const issue: WeeklyMedicalIssue = { memberId: member.memberId, memberName: member.memberName, details: medicalDetails.trim(), actionTaken: medicalAction.trim() };
    setDraft({ ...draft, medicalIssues: [...draft.medicalIssues, issue] });
    setMedicalMemberId("");
    setMedicalDetails("");
    setMedicalAction("");
  };

  const copyMeeting = async (record: WeeklyMeetingRecord, date: string) => {
    setSaving(true);
    setError("");
    try {
      const id = await copyWeeklyMeeting(record, date, rosterEntries(record.section));
      setSuccess(`Meeting copied to ${displayDate(date)}.`);
      await refresh();
      if (date === today) {
        const copied = await loadWeeklyMeetings(adminProfile?.sections ?? [], canManageAllSections);
        const match = copied.find((item) => item.id === id);
        if (match) setDraft(match);
      }
    } catch (copyError) {
      console.error("Unable to copy weekly meeting:", copyError);
      setError("Unable to copy this meeting.");
    } finally {
      setSaving(false);
    }
  };

  const openMeetings = records.filter((record) => record.status !== "closed");
  const history = records.filter((record) => record.status === "closed");
  const presentCount = draft?.entries.filter((entry) => entry.attendance === "present").length ?? 0;

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="lg">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Weekly Section Tracker" description="Plan a meeting, run it step by step, close it into history, then reuse good meeting structures later." />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {loading ? <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}><CircularProgress /></Box> : <>
        {!draft && <>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
            <Button variant="contained" color="success" onClick={() => setCreating((value) => !value)}>{creating ? "Cancel" : "Create Meeting"}</Button>
          </Stack>

          {creating && <Paper elevation={2} sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Create meeting</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              <TextField select label="Section" value={createSection} onChange={(event) => setCreateSection(event.target.value)}>{availableSections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}</TextField>
              <TextField label="Meeting date" type="date" value={createDate} onChange={(event) => setCreateDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="Location" value={createLocation} onChange={(event) => setCreateLocation(event.target.value)} helperText="Defaults to Scout Den; enter an alternate location when needed." />
              <Box />
              <TextField multiline minRows={4} label="Planned games & activities" value={createActivities} onChange={(event) => setCreateActivities(event.target.value)} helperText="One per line or comma separated." />
              <TextField multiline minRows={4} label="Planned badgework" value={createBadgework} onChange={(event) => setCreateBadgework(event.target.value)} helperText="One badge/activity per line or comma separated." />
            </Box>
            <Button variant="contained" color="success" onClick={() => void createMeeting()} disabled={saving} sx={{ mt: 2 }}>{saving ? "Creating…" : "Create & Track Attendance"}</Button>
          </Paper>}

          <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Planned & open meetings</Typography>
            {openMeetings.length === 0 ? <Alert severity="info">No planned or open meetings.</Alert> : <Stack spacing={1.5}>{openMeetings.map((record) => <Paper key={record.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                <Box><Typography sx={{ fontWeight: 800 }}>{record.section} · {displayDate(record.meetingDate)}</Typography><Typography color="text.secondary">{record.location} · {record.status}</Typography></Box>
                <Button variant="contained" onClick={() => { setDraft(record); setStep("attendance"); }}>Open Meeting</Button>
              </Stack>
            </Paper>)}</Stack>}
          </Paper>
        </>}

        {draft && <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", mb: 2 }}>
            <Box>
              <Typography variant="h4" color="secondary" sx={{ fontWeight: 800 }}>{draft.section} · {displayDate(draft.meetingDate)}</Typography>
              <Typography color="text.secondary">{draft.location} · {draft.status}</Typography>
            </Box>
            <Button variant="outlined" onClick={() => setDraft(null)}>Back to meetings</Button>
          </Stack>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 1.5, mb: 2 }}>
            <TextField label="Meeting date" type="date" value={draft.meetingDate} onChange={(event) => setDraft({ ...draft, meetingDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Location" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
            <TextField label="Planned games & activities" value={draft.plannedActivities.join(", ")} onChange={(event) => setDraft({ ...draft, plannedActivities: listFromText(event.target.value) })} />
            <TextField label="Planned badgework" value={draft.plannedBadgework.join(", ")} onChange={(event) => setDraft({ ...draft, plannedBadgework: listFromText(event.target.value) })} />
          </Box>

          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
            <Button variant={step === "attendance" ? "contained" : "outlined"} onClick={() => setStep("attendance")}>1. Attendance</Button>
            <Button variant={step === "badgework" ? "contained" : "outlined"} onClick={() => setStep("badgework")}>2. Badgework</Button>
            <Button variant={step === "medical" ? "contained" : "outlined"} onClick={() => setStep("medical")}>3. Injuries / Medical</Button>
            <Button variant={step === "notes" ? "contained" : "outlined"} onClick={() => setStep("notes")}>4. Additional Notes</Button>
          </Stack>

          {step === "attendance" && <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}><Chip color="success" label={`${presentCount} / ${draft.entries.length} present`} /><Button variant="outlined" onClick={() => setDraft({ ...draft, entries: draft.entries.map((entry) => ({ ...entry, attendance: "present" })) })}>Mark all present</Button></Stack>
            <Stack spacing={0.75} data-testid="attendance-list">{draft.entries.map((entry) => <Paper key={entry.memberId} variant="outlined" sx={{ px: 1.25, py: 0.5 }}><FormControlLabel sx={{ m: 0, width: "100%", minHeight: 54 }} control={<Checkbox checked={entry.attendance === "present"} onChange={(event) => updateDraftEntry(entry.memberId, { attendance: event.target.checked ? "present" : "absent" })} slotProps={{ input: { "aria-label": `Present · ${entry.memberName}` } }} />} label={entry.memberName} /></Paper>)}</Stack>
          </Box>}

          {step === "badgework" && <Stack spacing={1.25}>
            {draft.plannedBadgework.length > 0 && <Alert severity="info">Planned: {draft.plannedBadgework.join(", ")}</Alert>}
            {draft.entries.map((entry) => <TextField key={entry.memberId} label={`Badgework completed · ${entry.memberName}`} value={entry.badges.join(", ")} onChange={(event) => updateDraftEntry(entry.memberId, { badges: listFromText(event.target.value) })} />)}
          </Stack>}

          {step === "medical" && <Box>
            <Alert severity="info" sx={{ mb: 2 }}>Record injuries or medical issues that arose during this meeting, along with the action taken.</Alert>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 2fr 2fr" }, gap: 1.5 }}>
              <TextField select label="Member" value={medicalMemberId} onChange={(event) => setMedicalMemberId(event.target.value)}>{draft.entries.map((entry) => <MenuItem key={entry.memberId} value={entry.memberId}>{entry.memberName}</MenuItem>)}</TextField>
              <TextField label="Injury / medical issue" value={medicalDetails} onChange={(event) => setMedicalDetails(event.target.value)} />
              <TextField label="Action taken" value={medicalAction} onChange={(event) => setMedicalAction(event.target.value)} />
            </Box>
            <Button variant="outlined" onClick={addMedicalIssue} sx={{ mt: 1.5 }}>Add medical record</Button>
            <Stack spacing={1} sx={{ mt: 2 }}>{draft.medicalIssues.map((issue, index) => <Paper key={`${issue.memberId}-${index}`} variant="outlined" sx={{ p: 1.5 }}><Typography sx={{ fontWeight: 800 }}>{issue.memberName}</Typography><Typography>{issue.details}</Typography>{issue.actionTaken && <Typography color="text.secondary">Action: {issue.actionTaken}</Typography>}</Paper>)}</Stack>
          </Box>}

          {step === "notes" && <TextField fullWidth multiline minRows={6} label="Additional notes" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3 }}>
            <Button variant="contained" onClick={() => void saveDraft()} disabled={saving}>Save Progress</Button>
            {draft.status !== "closed" && <Button variant="contained" color="success" onClick={() => void closeMeeting()} disabled={saving}>Close Meeting</Button>}
          </Stack>
        </Paper>}

        {!draft && <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Meeting history</Typography>
          {history.length === 0 ? <Alert severity="info">No closed meetings yet.</Alert> : <Stack spacing={1.5}>{history.map((record) => <Paper key={record.id} variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 800 }}>{record.section} · {displayDate(record.meetingDate)}</Typography>
            <Typography color="text.secondary" sx={{ mb: 1.5 }}>{record.location} · {record.entries.filter((entry) => entry.attendance === "present").length}/{record.entries.length} present</Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="outlined" onClick={() => { setDraft(record); setStep("attendance"); }}>Edit Meeting</Button>
              <Button variant="outlined" onClick={() => void copyMeeting(record, today)} disabled={saving}>Copy to Today</Button>
              <TextField size="small" label="Copy to date" type="date" value={copyDates[record.id] ?? ""} onChange={(event) => setCopyDates((current) => ({ ...current, [record.id]: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
              <Button variant="outlined" disabled={!copyDates[record.id] || saving} onClick={() => void copyMeeting(record, copyDates[record.id])}>Copy to Date</Button>
            </Stack>
          </Paper>)}</Stack>}
        </Paper>}
      </>}
    </Container>
  </Box>;
}
