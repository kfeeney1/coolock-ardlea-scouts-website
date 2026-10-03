import { Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { createEvent, loadEvents } from "../services/eventAdmin";
import type { EventInput, EventRecord } from "../services/eventAdmin";
import { EMPTY_EVENT, EVENT_SECTIONS, EVENT_STATUSES, EVENT_TYPES, buildEventAudience, eventAudienceSummary, eventStatusLabel, isDuplicateEventIdentity } from "../services/eventManagementLogic";
import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";

export default function CreateEventPage() {
  const navigate = useNavigate();
  const { user, adminProfile } = useAdminAuth();
  const scopeKey = JSON.stringify([user?.uid, adminProfile?.role, adminProfile?.sections]);
  const [loadedScope, setLoadedScope] = useState("");
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [draft, setDraft] = useState<EventInput>(EMPTY_EVENT);
  const [memberSearch, setMemberSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
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
      })
      .catch((loadError) => {
        console.error("Unable to load event creation data:", loadError);
        if (active) setLoadError("Unable to load event creation data. Retry before selecting an audience or creating this event.");
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

  useEffect(() => {
    if (!hasMeaningfulDraft) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasMeaningfulDraft]);

  const activeMembers = useMemo(() => dataReady ? members.filter((member) => member.status === "active") : [], [dataReady, members]);
  const visibleMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return activeMembers.filter((member) => !query || `${member.displayName} ${member.section}`.toLowerCase().includes(query));
  }, [activeMembers, memberSearch]);

  const audience = useMemo(() => {
    const selectedIds = draft.audience?.memberIds ?? [];
    const sectionIds = draft.audience?.sectionIds
      ?? (draft.section === "All Sections" ? [...new Set(activeMembers.map((member) => member.section))] : [draft.section]);
    return buildEventAudience(sectionIds, selectedIds, members);
  }, [activeMembers, draft.audience, draft.section, members]);

  const updateSection = (section: string) => {
    const memberIds = draft.audience?.memberIds ?? [];
    const sectionIds = section === "All Sections" ? [] : [section];
    setDraft({ ...draft, section, audience: buildEventAudience(sectionIds, memberIds, members) });
  };

  const toggleMember = (memberId: string) => {
    const selected = new Set(draft.audience?.memberIds ?? []);
    if (selected.has(memberId)) selected.delete(memberId);
    else selected.add(memberId);
    const sectionIds = draft.audience?.sectionIds
      ?? (draft.section === "All Sections" ? [] : [draft.section]);
    setDraft({ ...draft, audience: buildEventAudience(sectionIds, [...selected], members) });
  };

  const clear = () => {
    setDraft(EMPTY_EVENT);
    setMemberSearch("");
    setError("");
  };

  const requestExit = () => {
    if (saving) return;
    if (hasMeaningfulDraft) setConfirmDiscard(true);
    else navigate("/leader/events");
  };

  const save = async () => {
    if (saving || !dataReady) return;
    if (!draft.title.trim()) return setError("Event title is required.");
    if (!draft.startDate) return setError("Start date is required.");
    if (draft.endDate && draft.endDate < draft.startDate) return setError("End date cannot be before the start date.");
    if (isDuplicateEventIdentity(draft, events)) return setError("An event with this title, start date and section already exists. Open the existing event instead.");

    setSaving(true);
    setError("");
    try {
      const selectedIds = draft.audience?.memberIds ?? [];
      const sectionIds = draft.audience
        ? draft.audience.sectionIds
        : (draft.section === "All Sections" ? [...new Set(activeMembers.map((member) => member.section))] : [draft.section]);
      const eventId = await createEvent({ ...draft, audience: buildEventAudience(sectionIds, selectedIds, members) });
      navigate(`/leader/events/${encodeURIComponent(eventId)}`, { replace: true });
    } catch (saveError) {
      console.error("Unable to save event:", saveError);
      setError("Unable to save the event.");
    } finally {
      setSaving(false);
    }
  };

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 2, md: 5 } }} data-testid="event-create-page">
    <Container maxWidth="md">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Create Event" description="" actions={<Button variant="outlined" disabled={saving} onClick={requestExit}>Back to Events</Button>} />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loadError && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry</Button>}>{loadError}</Alert>}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2.25}>
          <TextField required label="Event title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <FormControl fullWidth><InputLabel id="event-type-label">Event type</InputLabel><Select labelId="event-type-label" id="event-type" label="Event type" value={draft.eventType} onChange={(event) => setDraft({ ...draft, eventType: event.target.value })}>{EVENT_TYPES.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
            <FormControl fullWidth disabled={!dataReady}><InputLabel id="event-section-label">Section</InputLabel><Select labelId="event-section-label" id="event-section" label="Section" value={draft.section} onChange={(event) => updateSection(String(event.target.value))}>{EVENT_SECTIONS.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Event audience</Typography>
            {!dataReady && !loadError && <Typography role="status">Loading event audience and duplicate checks…</Typography>}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Choose whole sections, individual members, or both. {eventAudienceSummary(audience.sectionIds, audience.memberIds, audience.resolvedMemberIds.length)}
            </Typography>
            <TextField fullWidth disabled={!dataReady} label="Search members" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} sx={{ mb: 1.5 }} />
            <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
              {visibleMembers.map((member) => {
                const selected = (draft.audience?.memberIds ?? []).includes(member.id);
                return <Chip key={member.id} label={`${member.displayName} · ${member.section}`} color={selected ? "primary" : "default"} variant={selected ? "filled" : "outlined"} disabled={!dataReady} onClick={() => toggleMember(member.id)} />;
              })}
            </Stack>
          </Box>

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
            <Button variant="outlined" disabled={saving} onClick={requestExit}>Cancel</Button>
          </Stack>
        </Stack>
      </Paper>
      <Dialog open={confirmDiscard} onClose={() => setConfirmDiscard(false)} aria-labelledby="discard-new-event-title">
        <DialogTitle id="discard-new-event-title">Discard this new event?</DialogTitle>
        <DialogContent><Typography>Your event details have not been saved. Cancel creation and discard them?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
          <Button color="warning" variant="contained" onClick={() => navigate("/leader/events", { replace: true })}>Discard and cancel</Button>
        </DialogActions>
      </Dialog>
    </Container>
  </Box>;
}
