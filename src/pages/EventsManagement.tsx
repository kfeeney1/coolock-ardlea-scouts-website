import { Alert, Box, Button, Container, Stack } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import EventEditorDialog from "../components/admin/EventEditorDialog";
import EventListPanel from "../components/admin/EventListPanel";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { createEvent, loadEvents } from "../services/eventAdmin";
import type { EventInput, EventRecord, EventStatus } from "../services/eventAdmin";
import { EMPTY_EVENT, filterEvents, isDuplicateEventIdentity } from "../services/eventManagementLogic";
import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";

export default function EventsManagement() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const requestedEventId = searchParams.get("event") ?? "";
    const [events, setEvents] = useState<EventRecord[]>([]);
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [search, setSearch] = useState("");
    const [sectionFilter, setSectionFilter] = useState("All Sections");
    const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all");
    const [draft, setDraft] = useState<EventInput>(EMPTY_EVENT);
    const [eventDialogOpen, setEventDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const [loadedEvents, loadedMembers] = await Promise.all([loadEvents(), loadMembers()]);
            setEvents(loadedEvents);
            setMembers(loadedMembers);
            if (requestedEventId && loadedEvents.some((event) => event.id === requestedEventId)) {
                navigate(`/leader/events/${encodeURIComponent(requestedEventId)}`, { replace: true });
            }
        } catch (loadError) {
            console.error("Unable to load events:", loadError);
            setError("Unable to load events and activities.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, [requestedEventId]);

    const visibleEvents = useMemo(() => filterEvents(events, search, sectionFilter, statusFilter), [events, search, sectionFilter, statusFilter]);

    const openCreate = () => {
        setDraft(EMPTY_EVENT);
        setMessage("");
        setError("");
        setEventDialogOpen(true);
    };

    const saveEvent = async () => {
        if (!draft.title.trim()) return setError("Event title is required.");
        if (!draft.startDate) return setError("Start date is required.");
        if (draft.endDate && draft.endDate < draft.startDate) return setError("End date cannot be before the start date.");
        if (isDuplicateEventIdentity(draft, events)) return setError("An event with this title, start date and section already exists. Open the existing event instead.");
        setSaving(true);
        setError("");
        try {
            const eventId = await createEvent(draft);
            setEventDialogOpen(false);
            setMessage("Event created.");
            navigate(`/leader/events/${encodeURIComponent(eventId)}`);
        } catch (saveError) {
            console.error("Unable to save event:", saveError);
            setError("Unable to save the event.");
        } finally {
            setSaving(false);
        }
    };

    return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
        <Container maxWidth="xl">
            <LeaderDashboardHeader />
            <LeaderPageHeader title="Events & Activities" description="Select an event to open its full record, attendance, consent, badgework, equipment, gallery and reports." actions={<Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><Button variant="outlined" color="secondary" onClick={() => void load()}>Refresh</Button><Button variant="contained" color="success" onClick={openCreate}>Add Event</Button></Stack>} />
            {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
            <EventListPanel events={events} visibleEvents={visibleEvents} members={members} loading={loading} search={search} sectionFilter={sectionFilter} statusFilter={statusFilter} onSearchChange={setSearch} onSectionFilterChange={setSectionFilter} onStatusFilterChange={setStatusFilter} />
            <EventEditorDialog open={eventDialogOpen} editing={null} draft={draft} saving={saving} onClose={() => setEventDialogOpen(false)} onChange={setDraft} onSave={() => void saveEvent()} />
        </Container>
    </Box>;
}
