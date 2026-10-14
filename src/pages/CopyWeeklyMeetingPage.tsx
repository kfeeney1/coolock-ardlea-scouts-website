import { Alert, Box, Button, CircularProgress, Container, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { recordAuditEvent } from "../services/auditLog";
import { copyEquipmentRequirement } from "../services/equipmentProgramme";
import { effectiveOperationalSections } from "../services/leaderAccessLogic";
import { loadAttendanceInsightMembers } from "../services/reporting";
import { createWeeklyMeeting, loadWeeklyAccess, loadWeeklyMeetings } from "../services/weeklyTracker";
import type { WeeklyMeetingRecord } from "../services/weeklyTracker";
import { displayWeeklyDate, reconcileOpenWeeklyRoster } from "../services/weeklyTrackerLogic";

const today = () => new Date().toISOString().slice(0, 10);

export default function CopyWeeklyMeetingPage() {
  const { sourceId } = useParams();
  const navigate = useNavigate();
  const { adminProfile } = useAdminAuth();
  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
  const sections = useMemo(() => adminProfile ? effectiveOperationalSections(adminProfile.role, adminProfile.sections, adminProfile.appointments) : [], [adminProfile]);
  const [source, setSource] = useState<WeeklyMeetingRecord | null>(null);
  const [members, setMembers] = useState<Awaited<ReturnType<typeof loadAttendanceInsightMembers>>>([]);
  const [section, setSection] = useState("");
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const createdId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const sourceUrl = `/leader/weekly?meeting=${encodeURIComponent(sourceId ?? "")}`;
  const dirty = Boolean(source && (date !== today() || section !== source.section));
  const preview = useMemo(() => reconcileOpenWeeklyRoster([], members, section), [members, section]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const access = await loadWeeklyAccess();
        if (access.readOnly && !isAdmin) throw new Error("You do not have permission to copy meetings.");
        const [records, roster] = await Promise.all([
          loadWeeklyMeetings(adminProfile?.sections ?? [], !!isAdmin, isAdmin || access.canViewAll),
          loadAttendanceInsightMembers({ isAdmin: Boolean(isAdmin || access.canViewAll), sections })
        ]);
        if (!active) return;
        const found = records.find(record => record.id === sourceId);
        if (!found) throw new Error("Source meeting not found or not available to your account.");
        if (!sections.includes(found.section)) throw new Error("You are not authorised to copy this meeting.");
        setSource(found);
        setSection(found.section);
        setMembers(roster.filter(member => member.status === "active"));
      } catch (cause) {
        if (active) setError(applicationErrorMessage(cause, "Unable to load the meeting copy.", "CopyWeeklyMeetingPage"));
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [sourceId, adminProfile, isAdmin, sections]);

  useEffect(() => {
    if (!dirty || createdId.current) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const cancel = () => {
    if (saving) return;
    if (dirty && !discardConfirm) { setDiscardConfirm(true); return; }
    navigate(sourceUrl);
  };

  const create = async () => {
    if (!source || !date || !section || saving || inFlight.current) return;
    if (!sections.includes(section)) { setError("You are not authorised to copy a meeting into that section."); return; }
    if (createdId.current) { navigate(`/leader/weekly?meeting=${encodeURIComponent(createdId.current)}`); return; }
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const input = {
        section, meetingDate: date, status: "open" as const, location: source.location,
        theme: source.theme, activities: source.activities.map(a => ({ ...a, id: crypto.randomUUID() })),
        badgeworkPlan: source.badgeworkPlan.map(b => ({ ...b, id: crypto.randomUUID() })),
        programmeNotes: source.programmeNotes, notes: "", entries: preview, injuries: []
      };
      const id = await createWeeklyMeeting(input);
      createdId.current = id;
      // The meeting has been committed. Supporting operations must not cause duplicate creation.
      try {
        await copyEquipmentRequirement("weeklyMeeting", source.id, "weeklyMeeting", id, `${section} Weekly Meeting · ${date}`, section, date);
        await recordAuditEvent({ category: "system", action: "weekly-meeting-copy", targetId: id, targetLabel: `${section} Weekly Meeting · ${date}`, description: `Copied weekly meeting from ${source.meetingDate}.`, section });
      } catch (cause) {
        console.error("Meeting copy saved, but a supporting operation failed", cause);
      }
      navigate(`/leader/weekly?meeting=${encodeURIComponent(id)}`, { replace: true });
    } catch (cause) {
      setError(applicationErrorMessage(cause, "Unable to copy this meeting.", "CopyWeeklyMeetingPage"));
    } finally { inFlight.current = false; setSaving(false); }
  };

  return <Box sx={{ minHeight: "100vh", py: { xs: 2, md: 5 }, overflowX: "hidden" }}><Container maxWidth="lg">
    <LeaderDashboardHeader /><LeaderPageHeader title="Copy Meeting" description="Create a new meeting from an existing programme." />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {loading ? <CircularProgress /> : source && <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6">Source meeting</Typography>
        <Typography>{displayWeeklyDate(source.meetingDate)} · {source.section}</Typography>
        <Typography color="text.secondary">The source meeting, attendance and history remain unchanged.</Typography>
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}><Stack spacing={2}>
        <TextField select fullWidth label="Destination section" value={section} onChange={event => setSection(event.target.value)}>
          {sections.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
        </TextField>
        <TextField fullWidth label="Choose date" type="date" value={date} onChange={event => setDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Button sx={{ alignSelf: "flex-start" }} onClick={() => setDate(today())}>Today</Button>
        <Box data-testid="copy-attendance-preview">
          <Typography variant="h6">Attendance preview · {section} ({preview.length} members)</Typography>
          <Typography color="text.secondary">Attendance starts unrecorded. Source attendance, incidents and completed badgework are not copied.</Typography>
          <Stack component="ul" sx={{ pl: 3 }}>{preview.map(entry => <Typography component="li" key={entry.memberId}>{entry.memberName}</Typography>)}</Stack>
        </Box>
        {discardConfirm && <Alert severity="warning" action={<Button color="inherit" onClick={() => setDiscardConfirm(false)}>Keep editing</Button>}>Discard your destination or date changes?</Alert>}
        <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={1}>
          <Button disabled={saving} onClick={cancel}>{discardConfirm ? "Discard and cancel" : "Cancel copy"}</Button>
          <Button variant="contained" disabled={saving || !date || !section} onClick={() => void create()}>Create Copy</Button>
        </Stack>
      </Stack></Paper>
    </Stack>}
  </Container></Box>;
}
