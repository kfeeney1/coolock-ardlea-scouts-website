import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Button, Container, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import EventAudienceBuilder from "../components/admin/EventAudienceBuilder";
import { useSaveOnNavigation } from "../hooks/useSaveOnNavigation";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { createEvent, loadEvents } from "../services/eventAdmin";
import type { EventInput, EventRecord } from "../services/eventAdmin";
import { EMPTY_EVENT, EVENT_SECTIONS, EVENT_STATUSES, EVENT_TYPES, buildEventAudience, defaultEventAudienceForClassification, eventStatusLabel, isDuplicateEventIdentity } from "../services/eventManagementLogic";
import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";

export default function CreateEventPage() {
  const { user, adminProfile } = useAdminAuth();
  const scopeKey = JSON.stringify([user?.uid, adminProfile?.role, adminProfile?.sections]);
  const [loadedScope, setLoadedScope] = useState("");
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [initialAudience, setInitialAudience] = useState<EventInput["audience"]>(null);
  const [draft, setDraft] = useState<EventInput>(EMPTY_EVENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const createdEventId = useRef<string | null>(null);
  const createInFlight = useRef<Promise<boolean> | null>(null);
  const dataReady = !loading && !loadError && loadedScope === scopeKey;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadedScope("");
    setLoadError("");
    Promise.all([loadEvents(), loadMembers()])
      .then(([loadedEvents, loadedMembers]) => {
        if (!active) return;
        setLoadedScope(scopeKey);
        setEvents(loadedEvents);
        setMembers(loadedMembers);
        setInitialAudience(defaultEventAudienceForClassification("All Sections", loadedMembers));
      })
      .catch((loadError) => {
        if (active) setLoadError(applicationErrorMessage(loadError, "Unable to load event creation data. Retry before selecting an audience or creating this event.", "CreateEventPage"));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadAttempt, scopeKey]);

  const hasMeaningfulDraft = Boolean(
    draft.title.trim() || draft.description.trim() || draft.location.trim() || draft.meetingPoint.trim()
    || draft.returnDetails.trim() || draft.leaderNotes.trim() || draft.startDate || draft.endDate
    || draft.eventType !== "Activity" || draft.section !== "All Sections" || draft.status !== "draft"
    || draft.consentRequired || (draft.audience?.memberIds.length ?? 0) > 0 || (draft.audience?.sectionIds.length ?? 0) > 0
  );

  const activeMembers = useMemo(() => dataReady ? members.filter((member) => member.status === "active") : [], [dataReady, members]);
  const updateSection = (section: string) => {
    if (!draft.audience) setInitialAudience(defaultEventAudienceForClassification(section, members));
    setDraft({ ...draft, section });
  };

  const clear = () => {
    setDraft(EMPTY_EVENT);
    setError("");
  };

  const createDraft = async (force = false): Promise<boolean> => {
    if (createInFlight.current) return createInFlight.current;
    if (createdEventId.current) return true;
    if (!hasMeaningfulDraft && !force) return true;
    if (saving || !dataReady) return false;
    if (!draft.title.trim()) { setError("Event title is required. Complete it before leaving this event."); return false; }
    if (!draft.startDate) { setError("Start date is required. Complete it before leaving this event."); return false; }
    if (draft.endDate && draft.endDate < draft.startDate) { setError("End date cannot be before the start date. Correct it before leaving this event."); return false; }
    if (isDuplicateEventIdentity(draft, events)) { setError("An event with this title, start date and section already exists. Open the existing event instead."); return false; }

    setSaving(true);
    setError("");
    const pending = (async () => {
      try {
        const selectedSectionIds = draft.audience?.sectionIds ?? initialAudience?.sectionIds ?? [];
        const resolvedAudience = buildEventAudience(selectedSectionIds, draft.audience?.memberIds ?? initialAudience?.memberIds ?? [], members, draft.audience?.mode ?? initialAudience?.mode);
        if (resolvedAudience.resolvedMemberIds.length === 0) {
          setError("Choose at least one active member for the event audience before creating it.");
          return false;
        }
        const persistedDraft = {
          ...draft,
          endDate: draft.endDate || draft.startDate,
          audience: resolvedAudience
        };
        createdEventId.current = await createEvent(persistedDraft);
        return true;
      } catch (saveError) {
        setError(applicationErrorMessage(saveError, "Unable to save the event. Your edits are still here.", "CreateEventPage"));
        return false;
      } finally {
        setSaving(false);
        createInFlight.current = null;
      }
    })();
    createInFlight.current = pending;
    return pending;
  };

  const { navigateAfterSave, navigateWithoutSave } = useSaveOnNavigation(hasMeaningfulDraft, createDraft);
  const requestExit = () => { if (!saving) void navigateAfterSave("/leader/events", true); };
  const save = async () => {
    if (!(await createDraft(true)) || !createdEventId.current) return;
    navigateWithoutSave(`/leader/events/${encodeURIComponent(createdEventId.current)}`, true);
  };

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 2, md: 5 } }} data-testid="event-create-page">
    <Container maxWidth="md">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Create Event" description="" actions={<Button variant="outlined" disabled={saving || !dataReady} onClick={requestExit}>Back to Events</Button>} />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loadError && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry</Button>}>{loadError}</Alert>}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2.25}>
          <TextField required label="Event title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <FormControl fullWidth><InputLabel id="event-type-label">Event type</InputLabel><Select labelId="event-type-label" id="event-type" label="Event type" value={draft.eventType} onChange={(event) => setDraft({ ...draft, eventType: event.target.value })}>{EVENT_TYPES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
            <FormControl fullWidth disabled={!dataReady}><InputLabel id="event-section-label">Section</InputLabel><Select labelId="event-section-label" id="event-section" label="Section" value={draft.section} onChange={(event) => updateSection(String(event.target.value))}>{EVENT_SECTIONS.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
          </Box>

          {!dataReady && !loadError && <Box role="status">Loading event audience and duplicate checks…</Box>}
          <EventAudienceBuilder classificationSection={draft.section} audience={draft.audience ?? initialAudience} members={activeMembers} disabled={!dataReady || saving} onChange={(next) => setDraft({ ...draft, audience: next })} />

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <TextField required label="Start date" type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="End date" type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          </Box>
          <TextField label="Location" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
          <FormControl fullWidth><InputLabel id="event-status-label">Status</InputLabel><Select labelId="event-status-label" id="event-status" label="Status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as EventInput["status"] })}>{EVENT_STATUSES.filter((value) => value === "draft" || value === "open").map((value) => <MenuItem key={value} value={value}>{eventStatusLabel(value)}</MenuItem>)}</Select></FormControl>
          <FormControlLabel control={<Switch checked={draft.consentRequired} onChange={(event) => setDraft({ ...draft, consentRequired: event.target.checked })} />} label="Event consent required" />
          <TextField label="Meeting / departure details" value={draft.meetingPoint} onChange={(event) => setDraft({ ...draft, meetingPoint: event.target.value })} />
          <TextField label="Return / collection details" value={draft.returnDetails} onChange={(event) => setDraft({ ...draft, returnDetails: event.target.value })} />
          <TextField label="Description" multiline minRows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          <TextField label="Leader notes" multiline minRows={3} value={draft.leaderNotes} onChange={(event) => setDraft({ ...draft, leaderNotes: event.target.value })} helperText="Leader-only. Included on the leader event report." />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="contained" color="success" disabled={saving || !dataReady} onClick={() => void save()}>{saving ? "Creating…" : "Create Event"}</Button>
            <Button variant="outlined" disabled={saving} onClick={clear}>Clear</Button>
            <Button variant="outlined" disabled={saving || !dataReady} onClick={requestExit}>Cancel</Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  </Box>;
}
