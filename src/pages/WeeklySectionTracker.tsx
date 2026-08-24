import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
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
import { createWeeklyMeeting, loadWeeklyMeetings, updateWeeklyMeeting } from "../services/weeklyTracker";
import type { WeeklyMemberEntry, WeeklyMeetingRecord } from "../services/weeklyTracker";
import { buildWeeklyMemberSummaries, newWeeklyEntry } from "../services/weeklyTrackerLogic";

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
const today = new Date().toISOString().slice(0, 10);

function displayDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(parsed);
}

export default function WeeklySectionTracker() {
  const { adminProfile } = useAdminAuth();
  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
  const availableSections = useMemo(() => isAdmin ? GROUP_SECTIONS : adminProfile?.sections ?? [], [adminProfile?.sections, isAdmin]);
  const [section, setSection] = useState("");
  const [meetingDate, setMeetingDate] = useState(today);
  const [members, setMembers] = useState<AttendanceInsightMember[]>([]);
  const [records, setRecords] = useState<WeeklyMeetingRecord[]>([]);
  const [entries, setEntries] = useState<WeeklyMemberEntry[]>([]);
  const [notes, setNotes] = useState("");
  const [recordId, setRecordId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!section && availableSections.length > 0) setSection(availableSections[0]);
  }, [availableSections, section]);

  const refresh = async () => {
    setLoading(true);
    setError("");
    const scope = { isAdmin: Boolean(isAdmin), sections: adminProfile?.sections ?? [] };
    try {
      const [loadedMembers, loadedRecords] = await Promise.all([
        loadAttendanceInsightMembers(scope),
        loadWeeklyMeetings(adminProfile?.sections ?? [], Boolean(isAdmin))
      ]);
      setMembers(loadedMembers.filter((member) => member.status === "active"));
      setRecords(loadedRecords);
    } catch (loadError) {
      console.error("Unable to load weekly tracker:", loadError);
      setMembers([]);
      setRecords([]);
      setError("Unable to load weekly attendance data for your permitted sections.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [adminProfile?.sections, isAdmin]);

  useEffect(() => {
    if (!section) {
      setEntries([]);
      setNotes("");
      setRecordId(null);
      return;
    }
    const existing = records.find((record) => record.section === section && record.meetingDate === meetingDate);
    const currentMembers = members.filter((member) => member.section === section);
    const existingById = new Map(existing?.entries.map((entry) => [entry.memberId, entry]) ?? []);
    const roster = currentMembers.map((member) => existingById.get(member.id) ?? newWeeklyEntry(member.id, member.displayName));
    const currentIds = new Set(currentMembers.map((member) => member.id));
    const historicalOnly = existing?.entries.filter((entry) => !currentIds.has(entry.memberId)) ?? [];
    setEntries([...roster, ...historicalOnly].sort((a, b) => a.memberName.localeCompare(b.memberName)));
    setNotes(existing?.notes ?? "");
    setRecordId(existing?.id ?? null);
  }, [meetingDate, members, records, section]);

  const updateEntry = (memberId: string, patch: Partial<WeeklyMemberEntry>) => {
    setEntries((current) => current.map((entry) => entry.memberId === memberId ? { ...entry, ...patch } : entry));
  };

  const markAllPresent = () => {
    setEntries((current) => current.map((entry) => ({ ...entry, attendance: "present" })));
  };

  const save = async () => {
    setError("");
    setSuccess("");
    if (!section || !meetingDate || entries.length === 0) {
      setError("Choose a section and meeting date with at least one member in the roster.");
      return;
    }
    setSaving(true);
    try {
      const completedEntries = entries.map((entry) => ({
        ...entry,
        attendance: entry.attendance === "present" ? "present" as const : "absent" as const
      }));
      const input = { section, meetingDate, notes, entries: completedEntries };
      if (recordId) {
        await updateWeeklyMeeting(recordId, input);
        setSuccess("Attendance updated.");
      } else {
        await createWeeklyMeeting(input);
        setSuccess("Attendance saved.");
      }
      await refresh();
    } catch (saveError) {
      console.error("Unable to save weekly tracker:", saveError);
      setError("Unable to save this attendance record. Check your permissions and try again.");
    } finally {
      setSaving(false);
    }
  };

  const sectionRecords = records.filter((record) => record.section === section);
  const summaries = buildWeeklyMemberSummaries(sectionRecords);
  const presentCount = entries.filter((entry) => entry.attendance === "present").length;
  const totalCount = entries.length;
  const absentCount = totalCount - presentCount;

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="lg">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Weekly Section Tracker" description="Take attendance quickly during the meeting, then add optional meeting details when you have time." />

      {!isAdmin && availableSections.length === 0 && <Alert severity="warning" sx={{ mb: 3 }}>Your leader account has no sections assigned.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <TextField select label="Section" value={section} onChange={(event) => setSection(event.target.value)} disabled={availableSections.length === 0}>
            {availableSections.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
          <TextField label="Meeting date" type="date" slotProps={{ inputLabel: { shrink: true } }} value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} />
        </Box>
      </Paper>

      {loading ? <Box sx={{ minHeight: 280, display: "grid", placeItems: "center" }}><CircularProgress color="success" /></Box> : <>
        <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, mb: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2, justifyContent: "space-between", alignItems: { sm: "center" } }}>
            <Box>
              <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>{section || "Section"} · {displayDate(meetingDate)}</Typography>
              <Typography color="text.secondary">{recordId ? "Existing attendance record" : "New attendance record"}</Typography>
            </Box>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              <Chip color="success" label={`${presentCount} / ${totalCount} present`} />
              <Chip variant="outlined" label={`${absentCount} absent`} />
            </Stack>
          </Stack>

          <Button variant="outlined" color="success" onClick={markAllPresent} disabled={entries.length === 0} sx={{ mb: 2, minHeight: 48 }}>Mark all present</Button>

          {entries.length === 0 ? <Alert severity="info">No active members are available for this section.</Alert> : (
            <Stack spacing={0.75} data-testid="attendance-list">
              {entries.map((entry) => (
                <Paper key={entry.memberId} variant="outlined" sx={{ px: 1.25, py: 0.5 }}>
                  <FormControlLabel
                    sx={{ m: 0, width: "100%", minHeight: 54, "& .MuiFormControlLabel-label": { fontSize: { xs: "1.05rem", sm: "1rem" }, fontWeight: 700 } }}
                    control={<Checkbox size="medium" checked={entry.attendance === "present"} onChange={(event) => updateEntry(entry.memberId, { attendance: event.target.checked ? "present" : "absent" })} slotProps={{ input: { "aria-label": `Present · ${entry.memberName}` } }} />}
                    label={entry.memberName}
                  />
                </Paper>
              ))}
            </Stack>
          )}

          <Button variant="text" color="secondary" onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen} sx={{ mt: 2 }}>
            {detailsOpen ? "Hide meeting details" : "Add subs, badges & notes"}
          </Button>

          <Collapse in={detailsOpen} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 1.5, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Optional meeting details</Typography>
              <Stack spacing={1.25}>
                {entries.map((entry) => <Paper key={entry.memberId} variant="outlined" sx={{ p: 1.5 }}>
                  <Typography sx={{ fontWeight: 800, mb: 1 }}>{entry.memberName}</Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "180px 1fr" }, gap: 1.5, alignItems: "center" }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <FormControlLabel control={<Checkbox checked={entry.subsPaid} onChange={(event) => updateEntry(entry.memberId, { subsPaid: event.target.checked })} />} label="Subs paid" />
                      <TextField size="small" label="€" type="number" value={entry.subsAmount} disabled={!entry.subsPaid} onChange={(event) => updateEntry(entry.memberId, { subsAmount: Number(event.target.value) || 0 })} slotProps={{ htmlInput: { min: 0, step: "0.50" } }} sx={{ width: 90 }} />
                    </Stack>
                    <TextField size="small" label={`Badges · ${entry.memberName}`} helperText="Separate multiple badges with commas" value={entry.badges.join(", ")} onChange={(event) => updateEntry(entry.memberId, { badges: event.target.value.split(",").map((badge) => badge.trim()).filter(Boolean) })} />
                  </Box>
                </Paper>)}
              </Stack>
              <TextField fullWidth multiline minRows={3} label="Weekly notes" value={notes} onChange={(event) => setNotes(event.target.value)} sx={{ mt: 2 }} />
            </Box>
          </Collapse>
        </Paper>

        <Paper elevation={4} sx={{ position: "sticky", bottom: 8, zIndex: 5, p: 1.5, mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
          <Typography sx={{ fontWeight: 800 }}>{presentCount} of {totalCount} present</Typography>
          <Button variant="contained" color="success" onClick={() => void save()} disabled={saving || entries.length === 0} sx={{ minHeight: 48, minWidth: 150 }}>
            {saving ? "Saving..." : recordId ? "Update Attendance" : "Save Attendance"}
          </Button>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="h5" color="secondary" sx={{ fontWeight: 800, mb: 2 }}>Attendance history</Typography>
          {sectionRecords.length === 0 ? <Alert severity="info">No weekly attendance has been saved for this section yet.</Alert> : <>
            <Typography color="text.secondary" sx={{ mb: 2 }}>{sectionRecords.length} meeting{sectionRecords.length === 1 ? "" : "s"} recorded for {section}.</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
              {summaries.map((summary) => <Paper key={summary.memberId} variant="outlined" sx={{ p: 2 }}>
                <Typography sx={{ fontWeight: 800 }}>{summary.memberName}</Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
                  <Chip size="small" label={summary.attendanceRate === null ? "No attendance rate" : `${summary.attendanceRate}% attendance`} />
                  <Chip size="small" variant="outlined" label={`${summary.present} present`} />
                  <Chip size="small" variant="outlined" label={`${summary.absent} absent`} />
                </Stack>
              </Paper>)}
            </Box>
          </>}
        </Paper>
      </>}
    </Container>
  </Box>;
}
