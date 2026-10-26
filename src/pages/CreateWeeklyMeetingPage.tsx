import { useMeetingExperience } from "../hooks/useMeetingExperience";
import { useConfirmEventLeave } from "../hooks/useConfirmEventLeave";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { calendarCreationDate } from "../services/calendarCreation";
import { calendarReturnPath } from "../services/calendarSourceLogic";
import DatePickerField from "../components/DatePickerField";
import { applicationErrorMessage, reportApplicationError, UserFacingError } from "../services/applicationErrors.ts";
import { Alert, Box, Button, Container, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useSaveOnNavigation } from "../hooks/useSaveOnNavigation";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadAttendanceInsightMembers } from "../services/reporting";
import { createWeeklyMeeting, defaultActivityPlans, defaultBadgeworkPlans, loadWeeklyAccess } from "../services/weeklyTracker";
import { reconcileOpenWeeklyRoster } from "../services/weeklyTrackerLogic";
import { recordAuditEvent } from "../services/auditLog";
import { effectiveOperationalSections } from "../services/leaderAccessLogic";
import { nextSectionMeetingDate } from "../services/weeklyMeetingDate.mjs";

export default function CreateWeeklyMeetingPage() {
  const navigation = useLocation();
  const navigate = useNavigate();
  const workflow = useMeetingExperience("create");
  const [clearOpen, setClearOpen] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const initialDate = calendarCreationDate(navigation.state);
  const back = calendarReturnPath(navigation.state);
  const { adminProfile } = useAdminAuth();
  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
  const [section, setSection] = useState("");
  const [date, setDate] = useState(initialDate);
  const dateManuallyChanged = useRef(Boolean(initialDate));
  const [location, setLocation] = useState("");
  const [theme, setTheme] = useState("");
  const [programmeNotes, setProgrammeNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [canViewAll, setCanViewAll] = useState(false);
  const createdMeetingId = useRef<string | null>(null);
  const createInFlight = useRef<Promise<boolean> | null>(null);
  const draftRef = useRef({ section, date, location, theme, programmeNotes });
  const sections = useMemo(() => adminProfile ? effectiveOperationalSections(adminProfile.role, adminProfile.sections, adminProfile.appointments) : [], [adminProfile]);
  const defaultSection = sections[0] ?? "";
  const defaultDate = initialDate || (section ? nextSectionMeetingDate(section) : "");
  const hasMeaningfulDraft = Boolean((section && section !== defaultSection) || (date && date !== defaultDate) || location.trim() || theme.trim() || programmeNotes.trim());
  draftRef.current = { section, date, location, theme, programmeNotes };

  useEffect(() => {
    void loadWeeklyAccess().then((access) => { setCanViewAll(access.canViewAll); setCanCreate(isAdmin || !access.readOnly); })
      .catch((failure) => setError(applicationErrorMessage(failure, "Unable to load meeting access.", "CreateWeeklyMeetingPage")))
      .finally(() => setAccessLoaded(true));
  }, []);

  useEffect(() => {
    if (!section && sections.length) {
      const initialSection = sections[0];
      setSection(initialSection);
      if (!dateManuallyChanged.current) setDate(nextSectionMeetingDate(initialSection));
    }
  }, [section, sections]);

  const clear = () => {
    dateManuallyChanged.current = false;
    setSection(defaultSection);
    setDate(defaultSection ? nextSectionMeetingDate(defaultSection) : "");
    setLocation("");
    setTheme("");
    setProgrammeNotes("");
    setError("");
  };

  const createDraft = async (force = false): Promise<boolean> => {
    if (!accessLoaded || !canCreate) { setError("You do not have permission to create meetings."); return false; }
    if (createInFlight.current) return createInFlight.current;
    if (createdMeetingId.current) return true;
    if (workflow.redesigned && !navigator.onLine) { setError("You are offline. Your draft is still here. Reconnect and try again."); return false; }
    const draft = draftRef.current;
    const expectedDate = initialDate || (draft.section ? nextSectionMeetingDate(draft.section) : "");
    const meaningful = Boolean((draft.section && draft.section !== defaultSection) || (draft.date && draft.date !== expectedDate) || draft.location.trim() || draft.theme.trim() || draft.programmeNotes.trim());
    if (!meaningful && !force) return true;
    if (saving) return false;
    if (!draft.section || !draft.date) { setError("Choose a section and meeting date before leaving this meeting."); return false; }

    setSaving(true);
    setError("");
    const pending = (async () => {
      try {
        const members = await loadAttendanceInsightMembers({ isAdmin: Boolean(isAdmin || canViewAll), sections });
        const roster = reconcileOpenWeeklyRoster([], members, draft.section);
        if (!roster.length) throw new UserFacingError("No active members are available for that section.");
        const input = { section: draft.section, meetingDate: draft.date, status: "open" as const, location: draft.location, theme: draft.theme, activities: defaultActivityPlans(), badgeworkPlan: defaultBadgeworkPlans(), programmeNotes: draft.programmeNotes, notes: "", entries: roster, injuries: [] };
        const id = await createWeeklyMeeting(input);
        createdMeetingId.current = id;
        try { await recordAuditEvent({ category: "system", action: "weekly-meeting-create", targetId: id, targetLabel: `${draft.section} Weekly Meeting · ${draft.date}`, description: "Created weekly meeting from dedicated creation workflow.", section: draft.section });
        } catch (failure) { reportApplicationError(failure, { area: "CreateWeeklyMeetingPage", operation: "Record created meeting audit", userMessage: "Meeting created; its activity log could not be updated." }); }
        return true;
      } catch (saveError) {
        setError(applicationErrorMessage(saveError, "Unable to save this meeting. Your edits are still here.", "CreateWeeklyMeetingPage"));
        return false;
      } finally {
        setSaving(false);
        createInFlight.current = null;
      }
    })();
    createInFlight.current = pending;
    return pending;
  };

  const { navigateWithoutSave } = useSaveOnNavigation(!workflow.redesigned && hasMeaningfulDraft, createDraft);
  const leave = useConfirmEventLeave(workflow.redesigned && hasMeaningfulDraft, () => createDraft(true));
  const cancel = async () => {
    if (saving) return;
    if (!hasMeaningfulDraft) {
      navigateWithoutSave(back || "/leader/weekly");
      return;
    }
    if (await createDraft(false)) navigateWithoutSave(back || "/leader/weekly");
  };
  const save = async () => {
    if (!(await createDraft(true)) || !createdMeetingId.current) return;
    if (workflow.redesigned) {
      leave.releaseAfterSuccessfulSave();
      navigate(`/leader/weekly?meeting=${encodeURIComponent(createdMeetingId.current)}&stage=plan`);
    } else navigateWithoutSave(back || `/leader/weekly?meeting=${encodeURIComponent(createdMeetingId.current)}`);
  };

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 2, md: 5 } }}>
    <Container maxWidth="md">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Create Meeting" description="" />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {workflow.changed && <Alert severity="info" sx={{ mb: 2 }}>The meeting workflow setting changed. This draft keeps its current layout until you leave.</Alert>}
      {!accessLoaded || !workflow.ready ? <Typography role="status">Loading meeting access…</Typography> : !canCreate ? <Alert severity="warning">You do not have permission to create meetings.</Alert> : <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: workflow.redesigned ? 3 : undefined }}>
        <Box component="fieldset" disabled={saving} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
        <Stack spacing={2}>
          <TextField select required label="Section" value={section} onChange={(event) => { const nextSection=event.target.value; setSection(nextSection); if(!dateManuallyChanged.current)setDate(nextSectionMeetingDate(nextSection)); }}>{sections.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
          <DatePickerField required label="Meeting date" value={date} onChange={(event) => { dateManuallyChanged.current=true; setDate(event.target.value); }} slotProps={{ inputLabel: { shrink: true } }} />
          {workflow.redesigned && <TextField label="Theme / programme title" value={theme} onChange={(event) => setTheme(event.target.value)} />}
          <TextField label="Location" value={location} onChange={(event) => setLocation(event.target.value)} />
          {!workflow.redesigned && <TextField label="Theme / programme title" value={theme} onChange={(event) => setTheme(event.target.value)} />}
          <TextField multiline minRows={workflow.redesigned ? 2 : 4} label="Programme notes" helperText={workflow.redesigned ? "Optional" : undefined} value={programmeNotes} onChange={(event) => setProgrammeNotes(event.target.value)} />
          <Typography variant="body2" color="text.secondary">More than one meeting may be created on the same date. Each meeting is stored under its own stable record ID.</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ "& .MuiButton-root": { minHeight: 44 } }}>
            <Button variant="contained" color="success" disabled={saving} onClick={() => void save()}>{saving ? "Creating…" : workflow.redesigned ? "Create & plan" : "Create Meeting"}</Button>
            <Button variant="outlined" disabled={saving} onClick={() => workflow.redesigned && hasMeaningfulDraft ? setClearOpen(true) : clear()}>Clear</Button>
            {workflow.redesigned ? <Button component={Link} to={back || "/leader/weekly"} variant="outlined" disabled={saving}>Cancel</Button> : <Button variant="outlined" disabled={saving} onClick={cancel}>Cancel</Button>}
          </Stack>
        </Stack>
        </Box>
      </Paper>}
      <Dialog open={leave.dialogOpen} onClose={saving ? undefined : leave.stay} aria-labelledby="meeting-create-unsaved-title" aria-describedby="meeting-create-unsaved-description" fullWidth maxWidth="xs">
        <DialogTitle id="meeting-create-unsaved-title">Unsaved meeting changes</DialogTitle>
        <DialogContent><Typography id="meeting-create-unsaved-description">Save this meeting before leaving, discard your draft without creating a meeting, or stay here.</Typography></DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", "& .MuiButton-root": { minHeight: 44 } }}>
          <Button autoFocus disabled={saving} onClick={leave.stay}>Stay</Button>
          <Button color="error" disabled={saving} onClick={leave.continueWithoutSaving}>Discard</Button>
          <Button variant="contained" disabled={saving} onClick={() => void leave.saveAndContinue()}>Save</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={clearOpen} onClose={() => setClearOpen(false)} aria-labelledby="meeting-create-clear-title" fullWidth maxWidth="xs">
        <DialogTitle id="meeting-create-clear-title">Clear meeting draft?</DialogTitle>
        <DialogContent>Your entered details will be discarded. No meeting will be created.</DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", "& .MuiButton-root": { minHeight: 44 } }}><Button autoFocus onClick={() => setClearOpen(false)}>Stay</Button><Button color="error" onClick={() => { clear(); setClearOpen(false); }}>Clear draft</Button></DialogActions>
      </Dialog>
    </Container>
  </Box>;
}
