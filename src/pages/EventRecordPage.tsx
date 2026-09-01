import { Alert, Box, Button, Chip, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import EventEditorDialog from "../components/admin/EventEditorDialog";
import EventGalleryDialog from "../components/admin/EventGalleryDialog";
import EventRosterDialog from "../components/admin/EventRosterDialog";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import ProgrammeEquipmentDialog from "../components/admin/ProgrammeEquipmentDialog";
import { badgeworkSourceHref } from "../services/adventureSkillSourceContext";
import { loadEquipmentItems } from "../services/equipment";
import type { EquipmentItem } from "../services/equipment";
import { loadEquipmentLoans } from "../services/equipmentLoans";
import type { EquipmentLoan } from "../services/equipmentLoans";
import { loadEvents, updateEvent, updateEventRoster } from "../services/eventAdmin";
import type { AttendanceStatus, EventConsentStatus, EventInput, EventRecord } from "../services/eventAdmin";
import { eventCounts, eventInput, eventMembers, eventRosterCsv, eventRosterFilename, eventRosterPrintHtml, eventStatusLabel } from "../services/eventManagementLogic";
import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";

function statusColor(status: EventRecord["status"]): "default" | "success" | "warning" | "secondary" {
    if (status === "open") return "success";
    if (status === "closed") return "warning";
    if (status === "completed") return "secondary";
    return "default";
}

export default function EventRecordPage() {
    const { eventId = "" } = useParams();
    const navigate = useNavigate();
    const [event, setEvent] = useState<EventRecord | null>(null);
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
    const [equipmentLoans, setEquipmentLoans] = useState<EquipmentLoan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<EventInput | null>(null);
    const [saving, setSaving] = useState(false);
    const [rosterOpen, setRosterOpen] = useState(false);
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
    const [consent, setConsent] = useState<Record<string, EventConsentStatus>>({});
    const [savingRoster, setSavingRoster] = useState(false);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [equipmentOpen, setEquipmentOpen] = useState(false);

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const [loadedEvents, loadedMembers, loadedItems, loadedLoans] = await Promise.all([
                loadEvents(), loadMembers(), loadEquipmentItems(), loadEquipmentLoans()
            ]);
            const requested = loadedEvents.find((item) => item.id === eventId) ?? null;
            setEvent(requested);
            setMembers(loadedMembers);
            setEquipmentItems(loadedItems);
            setEquipmentLoans(loadedLoans);
            if (!requested) setError("This event could not be found or is outside your permitted sections.");
        } catch (loadError) {
            console.error("Unable to load event record:", loadError);
            setError("Unable to load this event record.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, [eventId]);

    const rosterMembers = useMemo(() => event ? eventMembers(event, members) : [], [event, members]);
    const summary = event ? eventCounts(event, members) : null;
    const attendingMemberIds = event ? Object.entries(event.attendance).filter(([, status]) => status === "attending").map(([memberId]) => memberId) : [];
    const badgeworkHref = event ? badgeworkSourceHref({
        sourceType: event.eventType.toLowerCase().includes("activity") ? "activity" : "event",
        sourceId: event.id,
        memberIds: attendingMemberIds,
        returnTo: `/leader/events/${encodeURIComponent(event.id)}`
    }) : "/leader/badgework";

    const openEdit = () => {
        if (!event || event.status === "completed") return;
        setDraft(eventInput(event));
        setEditing(true);
        setMessage("");
        setError("");
    };

    const saveEvent = async () => {
        if (!event || !draft) return;
        if (!draft.title.trim()) return setError("Event title is required.");
        if (!draft.startDate) return setError("Start date is required.");
        if (draft.endDate && draft.endDate < draft.startDate) return setError("End date cannot be before the start date.");
        setSaving(true);
        setError("");
        try {
            await updateEvent(event.id, draft);
            setEditing(false);
            setMessage(draft.status === "completed" ? "Event completed and moved to history." : "Event updated.");
            await load();
        } catch (saveError) {
            console.error("Unable to save event:", saveError);
            setError("Unable to save the event.");
        } finally {
            setSaving(false);
        }
    };

    const openRoster = () => {
        if (!event) return;
        const nextAttendance: Record<string, AttendanceStatus> = {};
        const nextConsent: Record<string, EventConsentStatus> = {};
        eventMembers(event, members).forEach((member) => {
            nextAttendance[member.id] = event.attendance[member.id] || "invited";
            nextConsent[member.id] = event.consent[member.id] || (event.consentRequired ? "required" : "not-required");
        });
        setAttendance(nextAttendance);
        setConsent(nextConsent);
        setRosterOpen(true);
        setMessage("");
        setError("");
    };

    const saveRoster = async () => {
        if (!event || event.status === "completed") return;
        setSavingRoster(true);
        setError("");
        try {
            await updateEventRoster(event.id, attendance, consent);
            setRosterOpen(false);
            setMessage("Attendance and consent roster updated.");
            await load();
        } catch (saveError) {
            console.error("Unable to save event roster:", saveError);
            setError("Unable to save the attendance and consent roster.");
        } finally {
            setSavingRoster(false);
        }
    };

    const printRoster = () => {
        if (!event) return;
        const printWindow = window.open("", "_blank", "width=1200,height=850");
        if (!printWindow) return window.alert("Please allow pop-ups for this site to print the event report.");
        printWindow.document.write(eventRosterPrintHtml(event, members));
        printWindow.document.close();
    };

    const exportRoster = () => {
        if (!event) return;
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
            {loading ? <Box sx={{ minHeight: 320, display: "grid", placeItems: "center" }}><CircularProgress color="success" /></Box> : !event ? <>
                <LeaderPageHeader title="Event Record" description="Event details and actions." />
                <Alert severity="error" sx={{ mb: 3 }}>{error || "Event not found."}</Alert>
                <Button component={Link} to="/leader/events" variant="outlined">Back to Events & Activities</Button>
            </> : <>
                <LeaderPageHeader
                    title={event.title}
                    description={`${event.section} · ${event.eventType} · ${eventStatusLabel(event.status)}`}
                    actions={<Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button variant="outlined" onClick={() => navigate("/leader/events")}>Back to Events</Button><Button variant="outlined" color="secondary" onClick={() => void load()}>Refresh</Button></Stack>}
                />
                {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                {event.status === "completed" && <Alert severity="info" sx={{ mb: 3 }}>Completed event history is read-only. Attendance, reports, exports and gallery access remain available.</Alert>}

                <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }} data-testid={`event-record-${event.id}`}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
                        <Chip label={eventStatusLabel(event.status)} color={statusColor(event.status)} />
                        <Chip label={event.section} variant="outlined" />
                        <Chip label={event.eventType} variant="outlined" />
                        {event.consentRequired && <Chip label="Consent required" color="warning" variant="outlined" />}
                    </Stack>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
                        <Box><Typography variant="overline" color="text.secondary">Dates</Typography><Typography>{event.startDate}{event.endDate && event.endDate !== event.startDate ? ` to ${event.endDate}` : ""}</Typography></Box>
                        <Box><Typography variant="overline" color="text.secondary">Location</Typography><Typography>{event.location || "Not set"}</Typography></Box>
                        <Box><Typography variant="overline" color="text.secondary">Meeting point</Typography><Typography>{event.meetingPoint || "Not set"}</Typography></Box>
                        <Box><Typography variant="overline" color="text.secondary">Return details</Typography><Typography>{event.returnDetails || "Not set"}</Typography></Box>
                    </Box>
                    {event.description && <Box sx={{ mt: 2.5 }}><Typography variant="overline" color="text.secondary">Description</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{event.description}</Typography></Box>}
                    {event.leaderNotes && <Box sx={{ mt: 2.5 }}><Typography variant="overline" color="text.secondary">Leader notes</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{event.leaderNotes}</Typography></Box>}
                    {summary && <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 2.5 }}>
                        <Chip label={`${summary.attending} attending`} color="success" variant="outlined" />
                        <Chip label={`${summary.notAttending} not attending`} variant="outlined" />
                        <Chip label={`${summary.invited} invited`} variant="outlined" />
                        {event.consentRequired && <Chip label={`${summary.consentReceived} consent received`} color="success" variant="outlined" />}
                        {event.consentRequired && summary.consentOutstanding > 0 && <Chip label={`${summary.consentOutstanding} consent outstanding`} color="error" />}
                    </Stack>}
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
                    <Typography variant="h5" color="secondary" sx={{ mb: 2 }}>Event actions</Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1.25 }}>
                        <Button variant="contained" color={event.status === "completed" ? "secondary" : "success"} onClick={openRoster}>{event.status === "completed" ? "View Attendance" : "Attendance"}</Button>
                        {event.consentRequired && <Button component={Link} to={`/leader/event-consent?eventId=${encodeURIComponent(event.id)}`} variant="contained" color="warning">Manage Consent</Button>}
                        <Button component={Link} to={badgeworkHref} variant="contained" color="success" disabled={attendingMemberIds.length === 0}>Record Badgework</Button>
                        <Button variant="outlined" color="success" onClick={() => setGalleryOpen(true)}>Gallery</Button>
                        <Button variant="outlined" color="primary" onClick={() => setEquipmentOpen(true)}>Equipment</Button>
                        <Button variant="outlined" color="secondary" onClick={printRoster}>Report</Button>
                        <Button variant="outlined" color="secondary" onClick={exportRoster}>Export CSV</Button>
                        <Button variant="outlined" color="secondary" disabled={event.status === "completed"} onClick={openEdit}>Edit Event</Button>
                    </Box>
                </Paper>

                <EventEditorDialog open={editing} editing={event} draft={draft ?? eventInput(event)} saving={saving} onClose={() => setEditing(false)} onChange={setDraft} onSave={() => void saveEvent()} />
                <EventRosterDialog event={rosterOpen ? event : null} members={rosterMembers} attendance={attendance} consent={consent} saving={savingRoster} onAttendanceChange={setAttendance} onConsentChange={setConsent} onClose={() => setRosterOpen(false)} onSave={() => void saveRoster()} onPrint={printRoster} onExport={exportRoster} />
                <EventGalleryDialog event={galleryOpen ? event : null} onClose={() => setGalleryOpen(false)} />
                {equipmentOpen && <ProgrammeEquipmentDialog open sourceType={event.eventType.toLowerCase().includes("activity") ? "activity" : "event"} sourceId={event.id} sourceLabel={event.title} section={event.section} date={event.startDate} items={equipmentItems} loans={equipmentLoans} readOnly={event.status === "completed"} onClose={() => setEquipmentOpen(false)} onChanged={load} />}
            </>}
        </Container>
    </Box>;
}
