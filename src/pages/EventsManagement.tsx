import { Alert, Box, Button, Container, Stack } from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import EventEditorDialog from "../components/admin/EventEditorDialog";
import EventListPanel from "../components/admin/EventListPanel";
import EventRosterDialog from "../components/admin/EventRosterDialog";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { createEvent, loadEvents, updateEvent, updateEventRoster } from "../services/eventAdmin";
import type { AttendanceStatus, EventConsentStatus, EventInput, EventRecord, EventStatus } from "../services/eventAdmin";
import { EMPTY_EVENT, eventInput, eventMembers, eventRosterCsv, eventRosterFilename, eventRosterPrintHtml, filterEvents } from "../services/eventManagementLogic";
import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";

export default function EventsManagement() {
    const [events, setEvents] = useState<EventRecord[]>([]);
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [search, setSearch] = useState("");
    const [sectionFilter, setSectionFilter] = useState("All Sections");
    const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all");
    const [editing, setEditing] = useState<EventRecord | null>(null);
    const [draft, setDraft] = useState<EventInput>(EMPTY_EVENT);
    const [eventDialogOpen, setEventDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rosterEvent, setRosterEvent] = useState<EventRecord | null>(null);
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
    const [consent, setConsent] = useState<Record<string, EventConsentStatus>>({});
    const [savingRoster, setSavingRoster] = useState(false);

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const [loadedEvents, loadedMembers] = await Promise.all([loadEvents(), loadMembers()]);
            setEvents(loadedEvents);
            setMembers(loadedMembers);
        } catch (loadError) {
            console.error("Unable to load events:", loadError);
            setError("Unable to load events and activities.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const visibleEvents = useMemo(() => filterEvents(events, search, sectionFilter, statusFilter), [events, search, sectionFilter, statusFilter]);
    const rosterMembers = useMemo(() => rosterEvent ? eventMembers(rosterEvent, members) : [], [members, rosterEvent]);

    const openCreate = () => {
        setEditing(null);
        setDraft(EMPTY_EVENT);
        setMessage("");
        setError("");
        setEventDialogOpen(true);
    };

    const openEdit = (event: EventRecord) => {
        if (event.status === "completed") return;
        setEditing(event);
        setDraft(eventInput(event));
        setMessage("");
        setError("");
        setEventDialogOpen(true);
    };

    const saveEvent = async () => {
        if (!draft.title.trim()) return setError("Event title is required.");
        if (!draft.startDate) return setError("Start date is required.");
        if (draft.endDate && draft.endDate < draft.startDate) return setError("End date cannot be before the start date.");
        setSaving(true);
        setError("");
        try {
            if (editing) {
                await updateEvent(editing.id, draft);
                setMessage(draft.status === "completed" ? "Event completed and moved to history." : "Event updated.");
            } else {
                await createEvent(draft);
                setMessage("Event created.");
            }
            setEventDialogOpen(false);
            await load();
        } catch (saveError) {
            console.error("Unable to save event:", saveError);
            setError("Unable to save the event.");
        } finally {
            setSaving(false);
        }
    };

    const openRoster = (event: EventRecord) => {
        const nextAttendance: Record<string, AttendanceStatus> = {};
        const nextConsent: Record<string, EventConsentStatus> = {};
        eventMembers(event, members).forEach((member) => {
            nextAttendance[member.id] = event.attendance[member.id] || "invited";
            nextConsent[member.id] = event.consent[member.id] || (event.consentRequired ? "required" : "not-required");
        });
        setRosterEvent(event);
        setAttendance(nextAttendance);
        setConsent(nextConsent);
        setMessage("");
        setError("");
    };

    const saveRoster = async () => {
        if (!rosterEvent || rosterEvent.status === "completed") return;
        setSavingRoster(true);
        setError("");
        try {
            await updateEventRoster(rosterEvent.id, attendance, consent);
            setMessage("Attendance and consent roster updated.");
            setRosterEvent(null);
            await load();
        } catch (saveError) {
            console.error("Unable to save event roster:", saveError);
            setError("Unable to save the attendance and consent roster.");
        } finally {
            setSavingRoster(false);
        }
    };

    const printRoster = (event: EventRecord) => {
        const printWindow = window.open("", "_blank", "width=1200,height=850");
        if (!printWindow) return window.alert("Please allow pop-ups for this site to print the event report.");
        printWindow.document.write(eventRosterPrintHtml(event, members));
        printWindow.document.close();
    };

    const exportRoster = (event: EventRecord) => {
        const blob = new Blob([eventRosterCsv(event, members)], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = eventRosterFilename(event.title);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
        <Container maxWidth="xl">
            <LeaderDashboardHeader />
            <LeaderPageHeader title="Events & Activities" description="Create camps, trips and activities, manage attendance and consent, and retain completed event history." actions={<Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><Button variant="outlined" color="secondary" onClick={() => void load()}>Refresh</Button><Button variant="contained" color="success" onClick={openCreate}>Add Event</Button></Stack>} />
            {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            <EventListPanel events={events} visibleEvents={visibleEvents} members={members} loading={loading} search={search} sectionFilter={sectionFilter} statusFilter={statusFilter} onSearchChange={setSearch} onSectionFilterChange={setSectionFilter} onStatusFilterChange={setStatusFilter} onEdit={openEdit} onRoster={openRoster} onPrint={printRoster} onExport={exportRoster} />

            <EventEditorDialog open={eventDialogOpen} editing={editing} draft={draft} saving={saving} onClose={() => setEventDialogOpen(false)} onChange={setDraft} onSave={() => void saveEvent()} />
            <EventRosterDialog event={rosterEvent} members={rosterMembers} attendance={attendance} consent={consent} saving={savingRoster} onAttendanceChange={setAttendance} onConsentChange={setConsent} onClose={() => setRosterEvent(null)} onSave={() => void saveRoster()} onPrint={() => rosterEvent && printRoster(rosterEvent)} onExport={() => rosterEvent && exportRoster(rosterEvent)} />
        </Container>
    </Box>;
}
