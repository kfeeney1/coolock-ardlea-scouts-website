import { applicationErrorMessage } from "../services/applicationErrors.ts";
import DateRangeFields from "../components/DateRangeFields";
import { Alert, Box, Button, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import EventAudienceBuilder from "../components/admin/EventAudienceBuilder";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useConfirmEventLeave } from "../hooks/useConfirmEventLeave";
import { eventInput, buildEventAudience, defaultEventAudienceForClassification, EVENT_SECTIONS, EVENT_STATUSES, EVENT_TYPES, eventStatusLabel } from "../services/eventManagementLogic";
import { loadEvents, updateEvent } from "../services/eventAdmin";
import type { EventInput, EventRecord, EventStatus } from "../services/eventAdmin";
import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";

type LoadedEventEditor = {
  eventId: string;
  event: EventRecord;
  draft: EventInput;
  baselineJson: string;
  members: MemberRecord[];
};

export default function EventEditPage() {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const [loadedEditor, setLoadedEditor] = useState<LoadedEventEditor | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const [confirmAudienceRemoval, setConfirmAudienceRemoval] = useState(false);
  const saveInFlight = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let active = true;
    setError("");
    setSaveFailed(false);
    setConfirmAudienceRemoval(false);
    void (async () => {
      try {
        const [events, loadedMembers] = await Promise.all([loadEvents(eventId), loadMembers()]);
        if (!active) return;
        const found = events.find((item) => item.id === eventId) ?? null;
        const initial = found ? {
          ...eventInput(found),
          audience: found.audience ?? defaultEventAudienceForClassification(found.section, loadedMembers)
        } : null;
        setLoadedEditor(found && initial ? {
          eventId,
          event: found,
          draft: initial,
          baselineJson: JSON.stringify(initial),
          members: loadedMembers
        } : null);
        if (!found) setError("This event could not be found or is outside your permitted sections.");
      } catch (loadError) {
        if (active) setError(applicationErrorMessage(loadError, "Unable to load this event.", "EventEditPage"));
      }
    })();
    return () => { active = false; };
  }, [eventId]);

  const currentEditor = loadedEditor?.eventId === eventId ? loadedEditor : null;
  const event = currentEditor?.event ?? null;
  const draft = currentEditor?.draft ?? null;
  const members = currentEditor?.members ?? [];
  const dirty = Boolean(currentEditor && JSON.stringify(currentEditor.draft) !== currentEditor.baselineJson);
  const saveState = saving ? "saving" : saveFailed ? "failed" : dirty ? "unsaved" : "saved";

  const activeMembers = useMemo(() => members.filter((member) => member.status === "active"), [members]);

  const updateDraft = useCallback((update: (current: EventInput) => EventInput) => {
    setLoadedEditor((current) => current?.eventId === eventId
      ? { ...current, draft: update(current.draft) }
      : current);
  }, [eventId]);

  const audienceRemovalCount = useMemo(() => {
    if (!event || !draft) return 0;
    const originalAudience = event.audience ?? defaultEventAudienceForClassification(event.section, activeMembers);
    const nextAudience = buildEventAudience(draft.audience?.sectionIds ?? [], draft.audience?.memberIds ?? [], activeMembers);
    const nextMemberIds = new Set(nextAudience.resolvedMemberIds);
    const visibleActiveIds = new Set(activeMembers.map((member) => member.id));
    return originalAudience.resolvedMemberIds.filter((memberId) => visibleActiveIds.has(memberId) && !nextMemberIds.has(memberId)).length;
  }, [activeMembers, draft, event]);
  const saveDraft = useCallback(async (removalsConfirmed = false): Promise<boolean> => {
    if (saveInFlight.current) return saveInFlight.current;
    if (!event || !draft) return false;
    if (!draft.title.trim() || !draft.startDate) {
      setError("Event title and start date are required. Complete them before leaving this event.");
      setSaveFailed(true);
      return false;
    }
    if (draft.endDate && draft.endDate < draft.startDate) {
      setError("End date cannot be before the start date. Correct it before leaving this event.");
      setSaveFailed(true);
      return false;
    }
    if (draft.audience?.mode === "members" && draft.audience.memberIds.length === 0) {
      setError("Select at least one member for this event before leaving.");
      setSaveFailed(true);
      return false;
    }
    if (!dirty) return true;

    const sectionIds = draft.audience
      ? draft.audience.sectionIds
      : (draft.section === "All Sections"
        ? [...new Set(activeMembers.flatMap((member) => member.sections?.length ? member.sections : [member.section]).filter(Boolean))]
        : [draft.section]);
    const audience = buildEventAudience(sectionIds, draft.audience?.memberIds ?? [], activeMembers);
    if (audience.resolvedMemberIds.length === 0) {
      setError("Choose at least one section or member for the event audience before leaving.");
      setSaveFailed(true);
      return false;
    }

    const committed = { ...draft, audience: { ...audience, mode: draft.audience?.mode ?? audience.mode } };
    setSaving(true);
    setSaveFailed(false);
    setError("");
    const pending = (async () => {
      try {
        await updateEvent(event.id, committed, removalsConfirmed);
        setLoadedEditor((current) => current?.eventId === eventId
          ? { ...current, draft: committed, baselineJson: JSON.stringify(committed) }
          : current);
        setSaveFailed(false);
        return true;
      } catch (saveError) {
        setSaveFailed(true);
        setError(applicationErrorMessage(saveError, "Unable to save this event. Your edits are still here.", "EventEditPage"));
        return false;
      } finally {
        setSaving(false);
        saveInFlight.current = null;
      }
    })();
    saveInFlight.current = pending;
    return pending;
  }, [activeMembers, draft, dirty, event, eventId]);

  const { dialogOpen, stay, continueWithoutSaving, saveAndContinue, releaseAfterSuccessfulSave } = useConfirmEventLeave(dirty, saveDraft);
  const saveAndReturnToEvents = useCallback(async (removalsConfirmed = false) => {
    if (audienceRemovalCount > 0 && !removalsConfirmed) {
      setConfirmAudienceRemoval(true);
      return;
    }
    if (await saveDraft(removalsConfirmed)) {
      releaseAfterSuccessfulSave();
      navigate("/leader/events");
    }
  }, [audienceRemovalCount, navigate, releaseAfterSuccessfulSave, saveDraft]);
  if (!draft) return <Box sx={{ minHeight: "100vh", py: 4 }}><Container maxWidth="lg"><LeaderDashboardHeader /><LeaderPageHeader title="Edit Event" description="" />{error && <Alert severity="error">{error}</Alert>}</Container></Box>;
  const selectedIds = draft.audience?.memberIds ?? [];

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 2, md: 5 } }}><Container maxWidth="lg">
    <LeaderDashboardHeader />
    <LeaderPageHeader title={`Edit event · ${event?.title ?? ""}`} description="" />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}><Box component="fieldset" disabled={saving} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}><Stack spacing={2}>
      <TextField required label="Event title" value={draft.title} onChange={(input) => updateDraft((current) => ({ ...current, title: input.target.value }))} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <FormControl><InputLabel id="event-edit-type-label">Event type</InputLabel><Select labelId="event-edit-type-label" label="Event type" value={draft.eventType} onChange={(input) => updateDraft((current) => ({ ...current, eventType: input.target.value }))}>{EVENT_TYPES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
        <FormControl><InputLabel id="event-edit-section-label">Section</InputLabel><Select labelId="event-edit-section-label" label="Section" value={draft.section} onChange={(input) => updateDraft((current) => ({ ...current, section: input.target.value }))}>{EVENT_SECTIONS.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
        <Box sx={{ gridColumn: "1 / -1" }}><DateRangeFields startDate={draft.startDate} endDate={draft.endDate} startLabel="Start date" endLabel="End date" startRequired onStartDateChange={(startDate) => updateDraft((current) => ({ ...current, startDate, ...(current.endDate && current.endDate < startDate ? { endDate: "" } : {}) }))} onEndDateChange={(endDate) => updateDraft((current) => ({ ...current, endDate }))} /></Box>
      </Box>
      <TextField label="Location" value={draft.location} onChange={(input) => updateDraft((current) => ({ ...current, location: input.target.value }))} />
      <TextField multiline minRows={3} label="Description" value={draft.description} onChange={(input) => updateDraft((current) => ({ ...current, description: input.target.value }))} />
      <TextField label="Meeting / departure details" value={draft.meetingPoint} onChange={(input) => updateDraft((current) => ({ ...current, meetingPoint: input.target.value }))} />
      <TextField label="Return / collection details" value={draft.returnDetails} onChange={(input) => updateDraft((current) => ({ ...current, returnDetails: input.target.value }))} />
      <TextField multiline minRows={3} label="Leader notes" value={draft.leaderNotes} onChange={(input) => updateDraft((current) => ({ ...current, leaderNotes: input.target.value }))} />
      <EventAudienceBuilder classificationSection={draft.section} audience={draft.audience} members={activeMembers} disabled={saving} onChange={(audience) => updateDraft((current) => ({ ...current, audience }))} />
      <FormControl><InputLabel id="event-edit-status-label">Status</InputLabel><Select labelId="event-edit-status-label" label="Status" value={draft.status} onChange={(input) => updateDraft((current) => ({ ...current, status: input.target.value as EventStatus }))}>{EVENT_STATUSES.map((value) => <MenuItem key={value} value={value}>{eventStatusLabel(value)}</MenuItem>)}</Select></FormControl>
      <FormControlLabel control={<Switch checked={draft.consentRequired} onChange={(input) => updateDraft((current) => ({ ...current, consentRequired: input.target.checked }))} />} label="Event consent required" />
      <Alert severity={saveState === "failed" ? "error" : "info"} role="status">{saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : saveState === "failed" ? "Save failed — your edits are still here." : "Saved"}</Alert>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button variant="contained" color="success" disabled={draft.audience?.mode === "members" && selectedIds.length === 0} onClick={() => void saveAndReturnToEvents()}>{saving ? "Saving…" : "Save Event"}</Button>
        <Button component="a" href={`/leader/events/${encodeURIComponent(eventId)}`} variant="outlined">Back to Event</Button>
      </Stack>
    </Stack></Box></Paper>
    <Dialog open={confirmAudienceRemoval} onClose={() => setConfirmAudienceRemoval(false)} aria-labelledby="event-audience-removal-title" aria-describedby="event-audience-removal-description" slotProps={{ paper: { role: "alertdialog" } }} fullWidth maxWidth="xs">
      <DialogTitle id="event-audience-removal-title">Confirm audience removals</DialogTitle>
      <DialogContent>
        <Typography id="event-audience-removal-description">
          This will remove {audienceRemovalCount} existing invitee{audienceRemovalCount === 1 ? "" : "s"} from this event. Their existing attendance and consent records will remain as history. Continue?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", px: 3, pb: 2, "& .MuiButton-root": { minHeight: 44, minWidth: 44 } }}>
        <Button onClick={() => setConfirmAudienceRemoval(false)} autoFocus disabled={saving}>Back to editing</Button>
        <Button color="error" onClick={() => { setConfirmAudienceRemoval(false); void saveAndReturnToEvents(true); }} disabled={saving}>Confirm removal and save</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={dialogOpen} onClose={stay} aria-labelledby="event-unsaved-title" aria-describedby="event-unsaved-description" slotProps={{ paper: { role: "alertdialog" } }} fullWidth maxWidth="xs">
      <DialogTitle id="event-unsaved-title">Unsaved event changes</DialogTitle>
      <DialogContent><Typography id="event-unsaved-description">You have changes that have not been saved. Save them before leaving, discard them, or stay in the editor.</Typography></DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", px: 3, pb: 2, "& .MuiButton-root": { minHeight: 44, minWidth: 44 } }}>
        <Button onClick={stay} autoFocus disabled={saving}>Stay</Button>
        <Button color="error" onClick={continueWithoutSaving} disabled={saving}>Discard</Button>
        <Button variant="contained" onClick={() => void saveAndContinue()} disabled={saving}>Save</Button>
      </DialogActions>
    </Dialog>
  </Container></Box>;
}
