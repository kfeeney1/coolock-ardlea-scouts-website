import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Button, Container, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadAttendanceInsightMembers } from "../services/reporting";
import { createWeeklyMeeting, defaultActivityPlans, defaultBadgeworkPlans, loadWeeklyAccess } from "../services/weeklyTracker";
import { reconcileOpenWeeklyRoster } from "../services/weeklyTrackerLogic";
import { recordAuditEvent } from "../services/auditLog";
import { effectiveOperationalSections } from "../services/leaderAccessLogic";

const today = new Date().toISOString().slice(0, 10);

export default function CreateWeeklyMeetingPage() {
  const { adminProfile } = useAdminAuth();
  const navigate = useNavigate();
  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
  const [section, setSection] = useState("");
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState("");
  const [theme, setTheme] = useState("");
  const [programmeNotes, setProgrammeNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [canViewAll, setCanViewAll] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const sections = useMemo(() => adminProfile ? effectiveOperationalSections(adminProfile.role, adminProfile.sections, adminProfile.appointments) : [], [adminProfile]);
  const defaultSection = sections[0] ?? "";
  const hasMeaningfulDraft = Boolean(
    (section && section !== defaultSection) || date !== today || location.trim() || theme.trim() || programmeNotes.trim()
  );

  useEffect(() => {
    void loadWeeklyAccess().then((access) => setCanViewAll(access.canViewAll))
      .catch((failure) => setError(applicationErrorMessage(failure, "Unable to load meeting access.", "CreateWeeklyMeetingPage")))
      .finally(() => setAccessLoaded(true));
  }, []);

  useEffect(() => {
    if (!section && sections.length) setSection(sections[0]);
  }, [section, sections]);

  useEffect(() => {
    if (!hasMeaningfulDraft) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasMeaningfulDraft]);

  const clear = () => {
    setSection(defaultSection);
    setDate(today);
    setLocation("");
    setTheme("");
    setProgrammeNotes("");
    setError("");
  };

  const cancel = () => {
    if (hasMeaningfulDraft) setConfirmDiscard(true);
    else navigate("/leader/weekly");
  };

  const save = async () => {
    if (saving) return;
    if (!section || !date) { setError("Choose a section and meeting date."); return; }
    setSaving(true);
    setError("");
    try {
      const members = await loadAttendanceInsightMembers({ isAdmin: Boolean(isAdmin || canViewAll), sections: adminProfile?.sections ?? [] });
      const roster = reconcileOpenWeeklyRoster([], members, section);
      if (!roster.length) throw new Error("No active members are available for that section.");
      const input = { section, meetingDate: date, status: "open" as const, location, theme, activities: defaultActivityPlans(), badgeworkPlan: defaultBadgeworkPlans(), programmeNotes, notes: "", entries: roster, injuries: [] };
      const id = await createWeeklyMeeting(input);
      await recordAuditEvent({ category: "system", action: "weekly-meeting-create", targetId: id, targetLabel: `${section} Weekly Meeting · ${date}`, description: "Created weekly meeting from dedicated creation workflow.", section });
      navigate(`/leader/weekly?meeting=${encodeURIComponent(id)}`);
    } catch (saveError) {
      setError(applicationErrorMessage(saveError, "Unable to create this meeting.", "CreateWeeklyMeetingPage"));
    } finally {
      setSaving(false);
    }
  };

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 2, md: 5 } }}>
    <Container maxWidth="md">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Create Meeting" description="" />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!accessLoaded ? <Typography role="status">Loading meeting access…</Typography> : <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <TextField select required label="Section" value={section} onChange={(event) => setSection(event.target.value)}>{sections.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
          <TextField required label="Meeting date" type="date" value={date} onChange={(event) => setDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Location" value={location} onChange={(event) => setLocation(event.target.value)} />
          <TextField label="Theme / programme title" value={theme} onChange={(event) => setTheme(event.target.value)} />
          <TextField multiline minRows={4} label="Programme notes" value={programmeNotes} onChange={(event) => setProgrammeNotes(event.target.value)} />
          <Typography variant="body2" color="text.secondary">More than one meeting may be created on the same date. Each meeting is stored under its own stable record ID.</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="contained" color="success" disabled={saving} onClick={() => void save()}>{saving ? "Creating…" : "Create Meeting"}</Button>
            <Button variant="outlined" disabled={saving} onClick={clear}>Clear</Button>
            <Button variant="outlined" disabled={saving} onClick={cancel}>Cancel</Button>
          </Stack>
        </Stack>
      </Paper>}
      <Dialog open={confirmDiscard} onClose={() => setConfirmDiscard(false)} aria-labelledby="discard-new-meeting-title">
        <DialogTitle id="discard-new-meeting-title">Discard this new meeting?</DialogTitle>
        <DialogContent><Typography>Your meeting details have not been saved. Cancel creation and discard them?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
          <Button color="warning" variant="contained" onClick={() => navigate("/leader/weekly")}>Discard and cancel</Button>
        </DialogActions>
      </Dialog>
    </Container>
  </Box>;
}
