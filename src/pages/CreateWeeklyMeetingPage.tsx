import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Button, Container, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
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

const today = new Date().toISOString().slice(0, 10);

export default function CreateWeeklyMeetingPage() {
  const { adminProfile } = useAdminAuth();
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
  const createdMeetingId = useRef<string | null>(null);
  const createInFlight = useRef<Promise<boolean> | null>(null);
  const draftRef = useRef({ section, date, location, theme, programmeNotes });
  const sections = useMemo(() => adminProfile ? effectiveOperationalSections(adminProfile.role, adminProfile.sections, adminProfile.appointments) : [], [adminProfile]);
  const defaultSection = sections[0] ?? "";
  const hasMeaningfulDraft = Boolean((section && section !== defaultSection) || date !== today || location.trim() || theme.trim() || programmeNotes.trim());
  draftRef.current = { section, date, location, theme, programmeNotes };

  useEffect(() => {
    void loadWeeklyAccess().then((access) => setCanViewAll(access.canViewAll))
      .catch((failure) => setError(applicationErrorMessage(failure, "Unable to load meeting access.", "CreateWeeklyMeetingPage")))
      .finally(() => setAccessLoaded(true));
  }, []);

  useEffect(() => {
    if (!section && sections.length) setSection(sections[0]);
  }, [section, sections]);

  const clear = () => {
    setSection(defaultSection);
    setDate(today);
    setLocation("");
    setTheme("");
    setProgrammeNotes("");
    setError("");
  };

  const createDraft = async (force = false): Promise<boolean> => {
    if (createInFlight.current) return createInFlight.current;
    if (createdMeetingId.current) return true;
    const draft = draftRef.current;
    const meaningful = Boolean((draft.section && draft.section !== defaultSection) || draft.date !== today || draft.location.trim() || draft.theme.trim() || draft.programmeNotes.trim());
    if (!meaningful && !force) return true;
    if (saving) return false;
    if (!draft.section || !draft.date) { setError("Choose a section and meeting date before leaving this meeting."); return false; }

    setSaving(true);
    setError("");
    const pending = (async () => {
      try {
        const members = await loadAttendanceInsightMembers({ isAdmin: Boolean(isAdmin || canViewAll), sections });
        const roster = reconcileOpenWeeklyRoster([], members, draft.section);
        if (!roster.length) throw new Error("No active members are available for that section.");
        const input = { section: draft.section, meetingDate: draft.date, status: "open" as const, location: draft.location, theme: draft.theme, activities: defaultActivityPlans(), badgeworkPlan: defaultBadgeworkPlans(), programmeNotes: draft.programmeNotes, notes: "", entries: roster, injuries: [] };
        const id = await createWeeklyMeeting(input);
        await recordAuditEvent({ category: "system", action: "weekly-meeting-create", targetId: id, targetLabel: `${draft.section} Weekly Meeting · ${draft.date}`, description: "Created weekly meeting from dedicated creation workflow.", section: draft.section });
        createdMeetingId.current = id;
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

  const { navigateWithoutSave } = useSaveOnNavigation(hasMeaningfulDraft, createDraft);
  const cancel = async () => {
    if (saving) return;
    if (!hasMeaningfulDraft) {
      navigateWithoutSave("/leader/weekly");
      return;
    }
    if (await createDraft(false)) navigateWithoutSave("/leader/weekly");
  };
  const save = async () => {
    if (!(await createDraft(true)) || !createdMeetingId.current) return;
    navigateWithoutSave(`/leader/weekly?meeting=${encodeURIComponent(createdMeetingId.current)}`);
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
    </Container>
  </Box>;
}
