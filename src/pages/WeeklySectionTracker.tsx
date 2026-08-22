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
  createWeeklyMeeting,
  loadWeeklyMeetings,
  updateWeeklyMeeting
} from "../services/weeklyTracker";
import type { WeeklyAttendance, WeeklyMemberEntry, WeeklyMeetingRecord } from "../services/weeklyTracker";
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
  const availableSections = useMemo(
    () => isAdmin ? GROUP_SECTIONS : adminProfile?.sections ?? [],
    [adminProfile?.sections, isAdmin]
  );
  const [section, setSection] = useState("");
  const [meetingDate, setMeetingDate] = useState(today);
  const [members, setMembers] = useState<AttendanceInsightMember[]>([]);
  const [records, setRecords] = useState<WeeklyMeetingRecord[]>([]);
  const [entries, setEntries] = useState<WeeklyMemberEntry[]>([]);
  const [notes, setNotes] = useState("");
  const [recordId, setRecordId] = useState<string | null>(null);
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
    try {
      const scope = { isAdmin: Boolean(isAdmin), sections: adminProfile?.sections ?? [] };
      const [loadedMembers, loadedRecords] = await Promise.all([
        loadAttendanceInsightMembers(scope),
        loadWeeklyMeetings(adminProfile?.sections ?? [], Boolean(isAdmin))
      ]);
      setMembers(loadedMembers.filter((member) => member.status === "active"));
      setRecords(loadedRecords);
    } catch (loadError) {
      console.error("Unable to load weekly tracker:", loadError);
      setError("Unable to load weekly records for your permitted sections.");
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
    setSuccess("");
  }, [meetingDate, members, records, section]);

  const updateEntry = (memberId: string, patch: Partial<WeeklyMemberEntry>) => {
    setEntries((current) => current.map((entry) => entry.memberId === memberId ? { ...entry, ...patch } : entry));
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
      const input = { section, meetingDate, notes, entries };
      if (recordId) {
        await updateWeeklyMeeting(recordId, input);
        setSuccess("Weekly meeting record updated.");
      } else {
        await createWeeklyMeeting(input);
        setSuccess("Weekly meeting record saved.");
      }
      await refresh();
    } catch (saveError) {
      console.error("Unable to save weekly tracker:", saveError);
      setError("Unable to save this weekly record. Check your permissions and try again.");
    } finally {
      setSaving(false);
    }
  };

  const sectionRecords = records.filter((record) => record.section === section);
  const summaries = buildWeeklyMemberSummaries(sectionRecords);
  const presentCount = entries.filter((entry) => entry.attendance === "present").length;
  const absentCount = entries.filter((entry) => entry.attendance === "absent").length;
  const subsThisWeek = entries.filter((entry) => entry.subsPaid).reduce((sum, entry) => sum + entry.subsAmount, 0);
  const badgesThisWeek = entries.reduce((sum, entry) => sum + entry.badges.length, 0);

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="xl">
      <LeaderDashboardHeader />
      <LeaderPageHeader
        title="Weekly Section Tracker"
        description="Record ordinary weekly meeting attendance, subs collected and badges achieved for each member in your section."
      />

      {!isAdmin && availableSections.length === 0 && <Alert severity="warning" sx={{ mb: 3 }}>Your leader account has no sections assigned.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <TextField select label="Section" value={section} onChange={(event) => setSection(event.target.value)} disabled={availableSections.length === 0}>
            {availableSections.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
          <TextField label="Meeting date" type="date" slotProps={{ inputLabel: { shrink: true } }} value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} />
        </Box>
      </Paper>

      {loading ? <Box sx={{ minHeight: 280, display: "grid", placeItems: "center" }}><CircularProgress color="success" /></Box> : <>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 2, mb: 3 }}>
          <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h4" color="secondary">{presentCount}</Typography><Typography color="text.secondary">Present</Typography></Paper>
          <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h4" color="secondary">{absentCount}</Typography><Typography color="text.secondary">Absent</Typography></Paper>
          <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h4" color="secondary">€{subsThisWeek.toFixed(2)}</Typography><Typography color="text.secondary">Subs recorded</Typography></Paper>
          <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h4" color="secondary">{badgesThisWeek}</Typography><Typography color="text.secondary">Badges achieved</Typography></Paper>
        </Box>

        <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 2, justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>{section || "Section"} · {displayDate(meetingDate)}</Typography>
              <Typography color="text.secondary">{recordId ? "Editing an existing weekly record." : "New weekly record."}</Typography>
            </Box>
            <Chip label={`${entries.length} members`} variant="outlined" />
          </Stack>

          {entries.length === 0 ? <Alert severity="info">No active members are available for this section.</Alert> : <Stack spacing={1.5}>
            {entries.map((entry) => <Paper key={entry.memberId} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(180px, 1.2fr) minmax(160px, 0.8fr) minmax(200px, 1fr) minmax(220px, 1.3fr)" }, gap: 2, alignItems: "center" }}>
                <Typography sx={{ fontWeight: 800 }}>{entry.memberName}</Typography>
                <TextField select size="small" label={`Attendance · ${entry.memberName}`} value={entry.attendance} onChange={(event) => updateEntry(entry.memberId, { attendance: event.target.value as WeeklyAttendance })}>
                  <MenuItem value="unrecorded">Not recorded</MenuItem>
                  <MenuItem value="present">Present</MenuItem>
                  <MenuItem value="absent">Absent</MenuItem>
                </TextField>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <FormControlLabel control={<Checkbox checked={entry.subsPaid} onChange={(event) => updateEntry(entry.memberId, { subsPaid: event.target.checked })} />} label="Subs paid" />
                  <TextField size="small" label="€" type="number" value={entry.subsAmount} disabled={!entry.subsPaid} onChange={(event) => updateEntry(entry.memberId, { subsAmount: Number(event.target.value) || 0 })} slotProps={{ htmlInput: { min: 0, step: "0.50" } }} sx={{ width: 100 }} />
                </Stack>
                <TextField size="small" label="Badges achieved" helperText="Separate multiple badges with commas" value={entry.badges.join(", ")} onChange={(event) => updateEntry(entry.memberId, { badges: event.target.value.split(",").map((badge) => badge.trim()).filter(Boolean) })} />
              </Box>
            </Paper>)}
          </Stack>}

          <TextField fullWidth multiline minRows={3} label="Weekly notes" value={notes} onChange={(event) => setNotes(event.target.value)} sx={{ mt: 2 }} />
          <Button variant="contained" color="success" onClick={() => void save()} disabled={saving || entries.length === 0} sx={{ mt: 2 }}>
            {saving ? "Saving..." : recordId ? "Update Weekly Record" : "Save Weekly Record"}
          </Button>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="h5" color="secondary" sx={{ fontWeight: 800, mb: 2 }}>Section history & member totals</Typography>
          {sectionRecords.length === 0 ? <Alert severity="info">No weekly records have been saved for this section yet.</Alert> : <>
            <Typography color="text.secondary" sx={{ mb: 2 }}>{sectionRecords.length} weekly meeting{sectionRecords.length === 1 ? "" : "s"} recorded.</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
              {summaries.map((summary) => <Paper key={summary.memberId} variant="outlined" sx={{ p: 2 }}>
                <Typography sx={{ fontWeight: 800 }}>{summary.memberName}</Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
                  <Chip size="small" label={summary.attendanceRate === null ? "No attendance rate" : `${summary.attendanceRate}% attendance`} />
                  <Chip size="small" variant="outlined" label={`${summary.present} present`} />
                  <Chip size="small" variant="outlined" label={`${summary.absent} absent`} />
                  <Chip size="small" variant="outlined" label={`€${summary.subsPaidTotal.toFixed(2)} subs`} />
                  <Chip size="small" variant="outlined" label={`${summary.badges.length} badges`} />
                </Stack>
                {summary.badges.length > 0 && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Badges: {summary.badges.join(", ")}</Typography>}
              </Paper>)}
            </Box>
          </>}
        </Paper>
      </>}
    </Container>
  </Box>;
}
