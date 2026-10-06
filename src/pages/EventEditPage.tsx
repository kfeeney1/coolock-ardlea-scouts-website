import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Button, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import EventAudienceBuilder from "../components/admin/EventAudienceBuilder";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useUnsavedNavigationGuard } from "../hooks/useUnsavedNavigationGuard";
import { eventInput, buildEventAudience, EVENT_SECTIONS, EVENT_STATUSES, EVENT_TYPES, eventStatusLabel } from "../services/eventManagementLogic";
import { loadEvents, updateEvent } from "../services/eventAdmin";
import type { EventInput, EventRecord, EventStatus } from "../services/eventAdmin";
import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";

const sameDraft = (a: EventInput | null, b: EventInput | null) => JSON.stringify(a) === JSON.stringify(b);

export default function EventEditPage() {
  const { eventId = "" } = useParams();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [draft, setDraft] = useState<EventInput | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "failed">("saved");
  const [ready, setReady] = useState(false);
  const [savedDraft, setSavedDraft] = useState<EventInput | null>(null);
  const dirty = ready && Boolean(draft) && !sameDraft(draft, savedDraft);
  const guard = useUnsavedNavigationGuard(dirty);

  useEffect(() => {
    let active = true;
    setReady(false);
    void (async () => {
      try {
        const [events, loadedMembers] = await Promise.all([loadEvents(), loadMembers()]);
        if (!active) return;
        const found = events.find((candidate) => candidate.id === eventId) ?? null;
        const loadedInput = found ? eventInput(found) : null;
        const initial = loadedInput && !loadedInput.audience
          ? { ...loadedInput, audience: buildEventAudience(loadedInput.section === "All Sections" ? [...new Set(loadedMembers.flatMap((member) => member.sections?.length ? member.sections : [member.section]).filter(Boolean))] : [loadedInput.section], [], loadedMembers) }
          : loadedInput;
        setEvent(found);
        setDraft(initial);
        setSavedDraft(initial);
        setMembers(loadedMembers);
        setReady(true);
        if (!found) setError("This event could not be found or is outside your permitted sections.");
      } catch (loadError) {
        if (active) setError(applicationErrorMessage(loadError, "Unable to load this event.", "EventEditPage"));
      }
    })();
    return () => { active = false; };
  }, [eventId]);

  useEffect(() => {
    if (draft && ready) setSaveState(sameDraft(draft, savedDraft) ? "saved" : "unsaved");
  }, [draft, ready, savedDraft]);

  const activeMembers = useMemo(() => members.filter((member) => member.status === "active"), [members]);

  const persist = async (): Promise<boolean> => {
    if (!event || !draft || saving) return false;
    if (!draft.title.trim() || !draft.startDate) {
      setError("Event title and start date are required.");
      return false;
    }
    if (draft.endDate && draft.endDate < draft.startDate) {
      setError("End date cannot be before the start date.");
      return false;
    }
    if (draft.audience?.mode === "members" && draft.audience.memberIds.length === 0) {
      setError("Select at least one member for this event.");
      return false;
    }
    const sectionIds = draft.audience?.sectionIds ?? (draft.section === "All Sections" ? [...new Set(activeMembers.flatMap((member) => member.sections?.length ? member.sections : [member.section]).filter(Boolean))] : [draft.section]);
    const audience = buildEventAudience(sectionIds, draft.audience?.memberIds ?? [], activeMembers);
    if (audience.resolvedMemberIds.length === 0) {
      setError("Choose at least one section or member for the event audience.");
      return false;
    }
    const committed = { ...draft, audience: { ...audience, mode: draft.audience?.mode ?? audience.mode } };
    setSaving(true);
    setSaveState("saving");
    setError("");
    try {
      await updateEvent(event.id, committed);
      setSavedDraft(committed);
      setDraft(committed);
      setSaveState("saved");
      return true;
    } catch (saveError) {
      setSaveState("failed");
      setError(applicationErrorMessage(saveError, "Unable to save the event. Your edits are still here.", "EventEditPage"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const leaveAfterSave = async () => {
    if (!(await persist())) return;
    guard.stay();
    guard.navigateTo(`/leader/events/${encodeURIComponent(eventId)}`);
  };

  if (!ready || !draft) return <Box sx={{ minHeight: "100vh", py: 4 }}><Container maxWidth="lg"><LeaderDashboardHeader /><LeaderPageHeader title="Edit Event" description="" />{error && <Alert severity="error">{error}</Alert>}</Container></Box>;

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 2, md: 5 } }}><Container maxWidth="lg">
    <LeaderDashboardHeader />
    <LeaderPageHeader title={`Edit event · ${event?.title ?? ""}`} description="" />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}><Stack spacing={2}>
      <TextField required label="Event title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <FormControl><InputLabel id="event-edit-type-label">Event type</InputLabel><Select labelId="event-edit-type-label" label="Event type" value={draft.eventType} onChange={(e) => setDraft({ ...draft, eventType: e.target.value })}>{EVENT_TYPES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
        <FormControl><InputLabel id="event-edit-section-label">Event section</InputLabel><Select labelId="event-edit-section-label" label="Event section" value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })}>{EVENT_SECTIONS.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
        <TextField required type="date" label="Start date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="date" label="End date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
      </Box>
      <TextField label="Location" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
      <TextField multiline minRows={3} label="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      <TextField label="Meeting / departure details" value={draft.meetingPoint} onChange={(e) => setDraft({ ...draft, meetingPoint: e.target.value })} />
      <TextField label="Return / collection details" value={draft.returnDetails} onChange={(e) => setDraft({ ...draft, returnDetails: e.target.value })} />
      <TextField multiline minRows={3} label="Leader notes" value={draft.leaderNotes} onChange={(e) => setDraft({ ...draft, leaderNotes: e.target.value })} />
      <FormControl><InputLabel id="event-edit-status-label">Status</InputLabel><Select labelId="event-edit-status-label" label="Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as EventStatus })}>{EVENT_STATUSES.map((value) => <MenuItem key={value} value={value}>{eventStatusLabel(value)}</MenuItem>)}</Select></FormControl>
      <FormControlLabel control={<Switch checked={draft.consentRequired} onChange={(e) => setDraft({ ...draft, consentRequired: e.target.checked })} />} label="Event consent required" />
      <EventAudienceBuilder classificationSection={draft.section} audience={draft.audience ?? null} members={activeMembers} onChange={(audience) => setDraft({ ...draft, audience })} />
      <Alert severity={saveState === "failed" ? "error" : "info"} role="status">{saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : saveState === "failed" ? "Save failed — your edits are still here." : "Saved"}</Alert>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button variant="contained" color="success" disabled={saving || (draft.audience?.mode === "members" && (draft.audience.memberIds.length === 0))} onClick={() => { void persist().then((saved) => { if (saved) guard.navigateTo(`/leader/events/${encodeURIComponent(eventId)}`); }); }}>{saving ? "Saving…" : "Save Event"}</Button>
        <Button variant="outlined" disabled={saving} onClick={() => guard.ask({ kind: "path", path: `/leader/events/${encodeURIComponent(eventId)}` })}>Back to Event</Button>
      </Stack>
    </Stack></Paper>
    <Dialog open={Boolean(guard.destination)} onClose={guard.stay} aria-labelledby="event-unsaved-title" fullWidth maxWidth="sm">
      <DialogTitle id="event-unsaved-title">Save changes before leaving?</DialogTitle>
      <DialogContent><Alert severity="info">This event has unsaved edits. Save them before navigating, stay and keep editing, or discard them explicitly.</Alert></DialogContent>
      <DialogActions><Button type="button" disabled={saving} onClick={(event) => { event.preventDefault(); event.stopPropagation(); guard.stay(); }}>Stay and keep editing</Button><Button type="button" disabled={saving} color="warning" onClick={guard.continueNavigation}>Discard and leave</Button><Button disabled={saving} variant="contained" onClick={() => { void leaveAfterSave(); }}>Save and leave</Button></DialogActions>
    </Dialog>
  </Container></Box>;
}
