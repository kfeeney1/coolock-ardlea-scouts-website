import DatePickerField from "../components/DatePickerField";
import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { applicationErrorMessage, reportApplicationError } from "../services/applicationErrors.ts";
import { loadAttendanceInsightMembers } from "../services/reporting";
import type { AttendanceInsightMember } from "../services/attendanceInsightsLogic";
import { effectiveOperationalSections } from "../services/leaderAccessLogic";
import { copyEquipmentRequirement } from "../services/equipmentProgramme";
import { recordAuditEvent } from "../services/auditLog";
import { loadWeeklyAccess, loadWeeklyMeetings, createWeeklyMeeting } from "../services/weeklyTracker";
import type { WeeklyAccess, WeeklyMeetingRecord } from "../services/weeklyTracker";
import { displayWeeklyDate, reconcileOpenWeeklyRoster } from "../services/weeklyTrackerLogic";

const today = new Date().toISOString().slice(0, 10);

type RouteState = { returnTo?: unknown };
type CopyDraft = { date: string; section: string };

function readCopyDraft(sourceMeetingId: string): CopyDraft | null {
  try {
    const value = sessionStorage.getItem(`weekly-meeting-copy:${sourceMeetingId}`);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<CopyDraft>;
    return typeof parsed.date === "string" && typeof parsed.section === "string"
      ? { date: parsed.date, section: parsed.section }
      : null;
  } catch {
    return null;
  }
}

function clearCopyDraft(sourceMeetingId: string) {
  try { sessionStorage.removeItem(`weekly-meeting-copy:${sourceMeetingId}`); } catch { /* Storage may be unavailable in private browsing. */ }
}

export default function CopyWeeklyMeetingPage() {
  const { sourceId: sourceMeetingId = "" } = useParams();
  const { adminProfile } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
  const availableSections = useMemo(() => adminProfile
    ? effectiveOperationalSections(adminProfile.role, adminProfile.sections, adminProfile.appointments)
    : [], [adminProfile]);
  const [source, setSource] = useState<WeeklyMeetingRecord | null>(null);
  const [members, setMembers] = useState<AttendanceInsightMember[]>([]);
  const [access, setAccess] = useState<WeeklyAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copyDate, setCopyDate] = useState(today);
  const [copySection, setCopySection] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [createdMeetingId, setCreatedMeetingId] = useState("");

  const readOnly = !isAdmin && access?.readOnly === true;
  const copyChanged = Boolean(source && (copyDate !== today || copySection !== source.section));
  const attendancePreview = useMemo(() => reconcileOpenWeeklyRoster(
    [], members.filter((member) => member.status === "active"), copySection
  ), [members, copySection]);
  const returnTo = (() => {
    const state = location.state as RouteState | null;
    const requested = state?.returnTo;
    if (typeof requested === "string" && ["/leader/weekly", `/leader/weekly?meeting=${encodeURIComponent(sourceMeetingId)}`].includes(requested)) return requested;
    return `/leader/weekly?meeting=${encodeURIComponent(sourceMeetingId)}`;
  })();

  useEffect(() => {
    let active = true;
    if (!adminProfile) return () => { active = false; };
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const weeklyAccess = await loadWeeklyAccess();
        const viewAll = isAdmin || weeklyAccess.canViewAll;
        const [records, loadedMembers] = await Promise.all([
          loadWeeklyMeetings(availableSections, isAdmin, weeklyAccess.canViewAll),
          loadAttendanceInsightMembers({ isAdmin: Boolean(viewAll), sections: availableSections })
        ]);
        if (!active) return;
        const meeting = records.find((record) => record.id === sourceMeetingId);
        if (!meeting) {
          setSource(null);
          setError("This meeting is unavailable or outside your authorised sections.");
          return;
        }
        setAccess(weeklyAccess);
        setSource(meeting);
        setMembers(loadedMembers);
        const savedDraft = readCopyDraft(sourceMeetingId);
        setCopyDate(savedDraft?.date || today);
        setCopySection(savedDraft && availableSections.includes(savedDraft.section) ? savedDraft.section : meeting.section);
      } catch (failure) {
        if (active) {
          setError(applicationErrorMessage(failure, "Unable to load the source meeting and attendance preview.", "CopyWeeklyMeetingPage"));
          reportApplicationError(failure, { area: "CopyWeeklyMeetingPage", operation: "Load source meeting and roster" });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [adminProfile, availableSections, isAdmin, sourceMeetingId]);

  useEffect(() => {
    if (!copyChanged || createdMeetingId) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [copyChanged, createdMeetingId]);

  useEffect(() => {
    if (!source || createdMeetingId || !copyDate || !copySection) return;
    try { sessionStorage.setItem(`weekly-meeting-copy:${sourceMeetingId}`, JSON.stringify({ date: copyDate, section: copySection })); }
    catch { /* Keep the in-memory draft usable when browser storage is unavailable. */ }
  }, [copyDate, copySection, createdMeetingId, source, sourceMeetingId]);

  const cancelCopy = () => {
    setConfirmDiscard(false);
    clearCopyDraft(sourceMeetingId);
    navigate(returnTo);
  };

  const requestCancel = () => {
    if (saving) return;
    if (copyChanged) setConfirmDiscard(true);
    else cancelCopy();
  };

  const copyMeeting = async () => {
    if (!source || !copyDate || !copySection || saving || createdMeetingId) return;
    if (readOnly || !availableSections.includes(copySection)) {
      setError("You are not authorised to copy a meeting into that section.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    let createdId = "";
    try {
      const input = {
        section: copySection,
        meetingDate: copyDate,
        status: "open" as const,
        location: source.location,
        theme: source.theme,
        activities: source.activities.map((activity) => ({ ...activity, id: crypto.randomUUID() })),
        badgeworkPlan: source.badgeworkPlan.map((badgework) => ({ ...badgework, id: crypto.randomUUID() })),
        programmeNotes: source.programmeNotes,
        notes: "",
        entries: attendancePreview,
        injuries: []
      };
      createdId = await createWeeklyMeeting(input);
      setCreatedMeetingId(createdId);
      clearCopyDraft(sourceMeetingId);

      const followUpIssues: string[] = [];
      try {
        await copyEquipmentRequirement("weeklyMeeting", source.id, "weeklyMeeting", createdId, `${copySection} Weekly Meeting · ${copyDate}`, copySection, copyDate);
      } catch (failure) {
        reportApplicationError(failure, { area: "CopyWeeklyMeetingPage", operation: "Copy planned equipment" });
        followUpIssues.push("The meeting was created, but its planned equipment could not be copied.");
      }
      try {
        await recordAuditEvent({ category: "system", action: "weekly-meeting-copy", targetId: createdId, targetLabel: `${copySection} Weekly Meeting · ${copyDate}`, description: `Copied weekly meeting from ${source.meetingDate}.`, section: copySection });
      } catch (failure) {
        reportApplicationError(failure, { area: "CopyWeeklyMeetingPage", operation: "Record copied meeting audit event" });
        followUpIssues.push("The meeting was created, but its audit entry could not be recorded.");
      }
      setNotice(followUpIssues.length
        ? `${followUpIssues.join(" ")} Do not submit again; the new meeting is saved.`
        : "Meeting copied. Planner rows and planned equipment were retained; attendance, completed badgework, injuries, checkout transactions and post-meeting notes were reset.");
    } catch (failure) {
      if (createdId) {
        setCreatedMeetingId(createdId);
        setNotice("The meeting was created, but its follow-up could not be completed. Do not submit again; open the saved meeting to continue.");
        reportApplicationError(failure, { area: "CopyWeeklyMeetingPage", operation: "Complete copied meeting setup" });
      } else {
        setError(applicationErrorMessage(failure, "Unable to copy this meeting. Your selected section and date are still here so you can try again.", "CopyWeeklyMeetingPage"));
        reportApplicationError(failure, { area: "CopyWeeklyMeetingPage", operation: "Create copied meeting" });
      }
    } finally {
      setSaving(false);
    }
  };

  const copyButtonDisabled = saving || readOnly || !copyDate || !copySection || !availableSections.includes(copySection);

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 2, md: 5 }, overflowX: "hidden" }}>
    <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 3 } }}>
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Copy Weekly Meeting" actions={<Button variant="outlined" disabled={saving} onClick={requestCancel}>Back to Source Meeting</Button>} />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}{!loading && !source && <Button sx={{ ml: 1 }} onClick={() => navigate("/leader/weekly")}>Weekly Meetings</Button>}</Alert>}
      {loading ? <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}><CircularProgress aria-label="Loading source meeting" /></Box> : source && <Stack spacing={2} data-testid="weekly-meeting-copy-page">
        {notice && <Alert severity={notice.startsWith("Meeting copied.") ? "success" : "warning"} role="status">{notice}</Alert>}
        {!notice && <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
          <Typography variant="h4" component="h2" color="secondary" sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>Copy {displayWeeklyDate(source.meetingDate)} · {source.section}</Typography>
          <Typography id="copy-weekly-meeting-description" color="text.secondary" sx={{ mt: 1, mb: 2 }}>Create a new meeting from this plan. The source meeting and its attendance history stay unchanged.</Typography>
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography sx={{ fontWeight: 700 }}>Source meeting</Typography>
              <Typography color="text.secondary">{source.section} · {displayWeeklyDate(source.meetingDate)}{source.theme ? ` · ${source.theme}` : ""}{source.location ? ` · ${source.location}` : ""}</Typography>
            </Paper>
            <TextField select fullWidth label="Destination section" value={copySection} onChange={(event) => setCopySection(event.target.value)} disabled={saving || readOnly}>
              {availableSections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}
            </TextField>
            <DatePickerField fullWidth label="Choose date" value={copyDate} onChange={(event) => setCopyDate(event.target.value)} disabled={saving} slotProps={{ inputLabel: { shrink: true } }} />
            <Paper data-testid="copy-attendance-preview" variant="outlined" sx={{ p: 1.5, minWidth: 0, overflowWrap: "anywhere" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Attendance preview · {copySection || "Select a destination section"} ({attendancePreview.length} members)</Typography>
              <Typography variant="body2" color="text.secondary">Attendance starts unrecorded. Source attendance, incidents and completed badgework are not copied.</Typography>
              {attendancePreview.length > 0
                ? <Box component="ul" sx={{ pl: 2.5, mb: 0 }}>{attendancePreview.map((entry) => <li key={entry.memberId}><Typography component="span" variant="body2">{entry.memberName}</Typography></li>)}</Box>
                : <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No active members are currently listed for this section.</Typography>}
            </Paper>
          </Stack>
          <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={1.5} sx={{ mt: 3, justifyContent: "flex-end" }}>
            <Button disabled={saving} onClick={requestCancel}>Cancel copy</Button>
            <Button variant="contained" color="success" disabled={copyButtonDisabled} onClick={() => void copyMeeting()}>{saving ? "Creating Copy…" : "Create Copy"}</Button>
          </Stack>
        </Paper>}
        {notice && createdMeetingId && <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button component={Link} to={`/leader/weekly?meeting=${encodeURIComponent(createdMeetingId)}`} state={{ returnTo }} variant="contained" color="success">Open copied meeting</Button>
          <Button onClick={() => navigate(returnTo)}>Return to source meeting</Button>
        </Stack>}
        {copyChanged && !createdMeetingId && <Typography variant="body2" color="text.secondary">Your destination and date changes stay on this page until you create the copy.</Typography>}
      </Stack>}
      <Dialog open={confirmDiscard} onClose={() => setConfirmDiscard(false)} aria-labelledby="discard-copy-meeting-title" fullWidth maxWidth="sm">
        <DialogTitle id="discard-copy-meeting-title">Discard this new meeting copy?</DialogTitle>
        <DialogContent><Typography>Your destination or date has changed. Cancel creation and discard these details?</Typography></DialogContent>
        <DialogActions sx={{ p: 2, flexDirection: { xs: "column-reverse", sm: "row" }, alignItems: { xs: "stretch", sm: "center" } }}>
          <Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
          <Button color="warning" variant="contained" onClick={cancelCopy}>Discard and cancel</Button>
        </DialogActions>
      </Dialog>
    </Container>
  </Box>;
}
