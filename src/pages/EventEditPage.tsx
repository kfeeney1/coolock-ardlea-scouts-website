import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Button, Chip, Container, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useSaveOnNavigation } from "../hooks/useSaveOnNavigation";
import { eventInput, buildEventAudience, eventAudienceSummary, EVENT_SECTIONS, EVENT_STATUSES, EVENT_TYPES, eventStatusLabel } from "../services/eventManagementLogic";
import { loadEvents, updateEvent } from "../services/eventAdmin";
import type { EventInput, EventRecord, EventStatus } from "../services/eventAdmin";
import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";

export default function EventEditPage() {
  const { eventId = "" } = useParams();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [draft, setDraft] = useState<EventInput | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedDraftJson, setSavedDraftJson] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const saveInFlight = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [events, loadedMembers] = await Promise.all([loadEvents(), loadMembers()]);
        if (!active) return;
        const found = events.find((item) => item.id === eventId) ?? null;
        const initial = found ? eventInput(found) : null;
        setEvent(found);
        setDraft(initial);
        setSavedDraftJson(initial ? JSON.stringify(initial) : "");
        setMembers(loadedMembers);
        if (!found) setError("This event could not be found or is outside your permitted sections.");
      } catch (loadError) {
        if (active) setError(applicationErrorMessage(loadError, "Unable to load this event.", "EventEditPage"));
      }
    })();
    return () => { active = false; };
  }, [eventId]);

  const dirty = Boolean(draft && savedDraftJson && JSON.stringify(draft) !== savedDraftJson);
  const saveState = saving ? "saving" : saveFailed ? "failed" : dirty ? "unsaved" : "saved";

  const activeMembers = useMemo(() => members.filter((member) => member.status === "active"), [members]);
  const saveDraft = useCallback(async (): Promise<boolean> => {
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

    const sectionIds = draft.audience?.sectionIds
      ?? (draft.section === "All Sections"
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
        await updateEvent(event.id, committed);
        setSavedDraftJson(JSON.stringify(committed));
        setDraft(committed);
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
  }, [activeMembers, draft, dirty, event]);

  const { navigateAfterSave } = useSaveOnNavigation(dirty, saveDraft);
  const selectedIds = draft?.audience?.memberIds ?? [];

  if (!draft) return <Box sx={{ minHeight: "100vh", py: 4 }}><Container maxWidth="lg"><LeaderDashboardHeader /><LeaderPageHeader title="Edit Event" description="" />{error && <Alert severity="error">{error}</Alert>}</Container></Box>;

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 2, md: 5 } }}><Container maxWidth="lg">
    <LeaderDashboardHeader />
    <LeaderPageHeader title={`Edit event · ${event?.title ?? ""}`} description="" />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}><Stack spacing={2}>
      <TextField required label="Event title" value={draft.title} onChange={(input) => setDraft({ ...draft, title: input.target.value })} />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <FormControl><InputLabel id="event-edit-type-label">Event type</InputLabel><Select labelId="event-edit-type-label" label="Event type" value={draft.eventType} onChange={(input) => setDraft({ ...draft, eventType: input.target.value })}>{EVENT_TYPES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
        <FormControl><InputLabel id="event-edit-section-label">Section</InputLabel><Select labelId="event-edit-section-label" label="Section" value={draft.section} onChange={(input) => {
          const section = input.target.value;
          setDraft({ ...draft, section, audience: { version: 2, semantics: "snapshot", mode: draft.audience?.mode ?? "sections", sectionIds: section === "All Sections" ? [] : [section], memberIds: draft.audience?.memberIds ?? [], resolvedMemberIds: draft.audience?.resolvedMemberIds ?? [] } });
        }}>{EVENT_SECTIONS.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
        <TextField required type="date" label="Start date" value={draft.startDate} onChange={(input) => setDraft({ ...draft, startDate: input.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="date" label="End date" value={draft.endDate} onChange={(input) => setDraft({ ...draft, endDate: input.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
      </Box>
      <TextField label="Location" value={draft.location} onChange={(input) => setDraft({ ...draft, location: input.target.value })} />
      <TextField multiline minRows={3} label="Description" value={draft.description} onChange={(input) => setDraft({ ...draft, description: input.target.value })} />
      <TextField label="Meeting / departure details" value={draft.meetingPoint} onChange={(input) => setDraft({ ...draft, meetingPoint: input.target.value })} />
      <TextField label="Return / collection details" value={draft.returnDetails} onChange={(input) => setDraft({ ...draft, returnDetails: input.target.value })} />
      <TextField multiline minRows={3} label="Leader notes" value={draft.leaderNotes} onChange={(input) => setDraft({ ...draft, leaderNotes: input.target.value })} />
      <Box>
        <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Event audience</Typography>
        <Alert severity="info" sx={{ mb: 1 }}>{eventAudienceSummary(draft.audience?.sectionIds ?? [], selectedIds, buildEventAudience(draft.audience?.sectionIds ?? [], selectedIds, activeMembers).resolvedMemberIds.length)}</Alert>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Button variant={selectedIds.length ? "outlined" : "contained"} onClick={() => setDraft({ ...draft, audience: { version: 2, semantics: "snapshot", mode: "sections", sectionIds: draft.section === "All Sections" ? [] : [draft.section], memberIds: [], resolvedMemberIds: [] } })}>Whole section</Button>
          <Button variant={selectedIds.length ? "contained" : "outlined"} onClick={() => setDraft({ ...draft, audience: { version: 2, semantics: "snapshot", mode: "members", sectionIds: draft.section === "All Sections" ? [] : [draft.section], memberIds: selectedIds, resolvedMemberIds: [] } })}>Selected members</Button>
        </Stack>
        {draft.audience?.mode === "members" && <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>{activeMembers.map((member) => {
          const selected = selectedIds.includes(member.id);
          return <Chip key={member.id} label={`${member.displayName} · ${member.section}`} clickable variant={selected ? "filled" : "outlined"} onClick={() => {
            const memberIds = selected ? selectedIds.filter((id) => id !== member.id) : [...selectedIds, member.id];
            setDraft({ ...draft, audience: { version: 2, semantics: "snapshot", mode: "members", sectionIds: draft.audience?.sectionIds ?? [], memberIds, resolvedMemberIds: [] } });
          }} />;
        })}</Stack>}
      </Box>
      <FormControl><InputLabel id="event-edit-status-label">Status</InputLabel><Select labelId="event-edit-status-label" label="Status" value={draft.status} onChange={(input) => setDraft({ ...draft, status: input.target.value as EventStatus })}>{EVENT_STATUSES.map((value) => <MenuItem key={value} value={value}>{eventStatusLabel(value)}</MenuItem>)}</Select></FormControl>
      <FormControlLabel control={<Switch checked={draft.consentRequired} onChange={(input) => setDraft({ ...draft, consentRequired: input.target.checked })} />} label="Event consent required" />
      <Alert severity={saveState === "failed" ? "error" : "info"} role="status">{saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : saveState === "failed" ? "Save failed — your edits are still here." : "Saved"}</Alert>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button variant="contained" color="success" disabled={saving || (draft.audience?.mode === "members" && selectedIds.length === 0)} onClick={() => void navigateAfterSave(`/leader/events/${encodeURIComponent(eventId)}`)}>{saving ? "Saving…" : "Save Event"}</Button>
        <Button variant="outlined" disabled={saving} onClick={() => void navigateAfterSave(`/leader/events/${encodeURIComponent(eventId)}`)}>Back to Event</Button>
      </Stack>
    </Stack></Paper>
    <Box sx={{ mt: 2 }} data-testid="event-audience-summary">{eventAudienceSummary(draft.audience?.sectionIds ?? [], selectedIds, buildEventAudience(draft.audience?.sectionIds ?? [], selectedIds, activeMembers).resolvedMemberIds.length)}</Box>
  </Container></Box>;
}
