import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import {
    Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions,
    DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel,
    MenuItem, Paper, Select, Stack, Switch, TextField, Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";
import { createEvent, loadEvents, updateEvent, updateEventRoster } from "../services/eventAdmin";
import type { AttendanceStatus, EventConsentStatus, EventInput, EventRecord, EventStatus } from "../services/eventAdmin";

const sections = ["All Sections", "Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group", "Other"];
const eventTypes = ["Weekly Meeting", "Activity", "Day Trip", "Camp", "Hike", "Fundraiser", "Other"];
const statuses: EventStatus[] = ["draft", "open", "closed", "completed"];

const emptyEvent: EventInput = {
    title: "", description: "", eventType: "Activity", section: "All Sections",
    location: "", meetingPoint: "", returnDetails: "", leaderNotes: "",
    startDate: "", endDate: "", status: "draft", consentRequired: false
};

const statusLabel = (status: EventStatus) => status.charAt(0).toUpperCase() + status.slice(1);
const statusColor = (status: EventStatus): "default" | "success" | "warning" | "secondary" =>
    status === "open" ? "success" : status === "closed" ? "warning" : status === "completed" ? "secondary" : "default";
const attendanceLabel = (status: AttendanceStatus) => status === "attending" ? "Attending" : status === "not-attending" ? "Not attending" : "Invited";
const consentLabel = (status: EventConsentStatus) => status === "received" ? "Received" : status === "required" ? "Outstanding" : "Not required";

function eventInput(record: EventRecord): EventInput {
    return {
        title: record.title, description: record.description, eventType: record.eventType,
        section: record.section, location: record.location, meetingPoint: record.meetingPoint,
        returnDetails: record.returnDetails, leaderNotes: record.leaderNotes,
        startDate: record.startDate, endDate: record.endDate, status: record.status,
        consentRequired: record.consentRequired
    };
}

function escapeHtml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

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
    const [draft, setDraft] = useState<EventInput>(emptyEvent);
    const [eventDialogOpen, setEventDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rosterEvent, setRosterEvent] = useState<EventRecord | null>(null);
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
    const [consent, setConsent] = useState<Record<string, EventConsentStatus>>({});
    const [savingRoster, setSavingRoster] = useState(false);

    const load = async () => {
        setLoading(true); setError("");
        try {
            const [loadedEvents, loadedMembers] = await Promise.all([loadEvents(), loadMembers()]);
            setEvents(loadedEvents); setMembers(loadedMembers);
        } catch (loadError) {
            console.error("Unable to load events:", loadError);
            setError("Unable to load events and activities.");
        } finally { setLoading(false); }
    };

    useEffect(() => { void load(); }, []);

    const visibleEvents = useMemo(() => {
        const query = search.trim().toLowerCase();
        return events.filter((event) => {
            if (sectionFilter !== "All Sections" && event.section !== "All Sections" && event.section !== sectionFilter) return false;
            if (statusFilter !== "all" && event.status !== statusFilter) return false;
            if (!query) return true;
            return [event.title, event.description, event.location, event.meetingPoint, event.section, event.eventType]
                .join(" ").toLowerCase().includes(query);
        });
    }, [events, search, sectionFilter, statusFilter]);

    const totals = useMemo(() => ({
        total: events.length,
        open: events.filter((event) => event.status === "open").length,
        draft: events.filter((event) => event.status === "draft").length,
        completed: events.filter((event) => event.status === "completed").length
    }), [events]);

    const rosterMembers = useMemo(() => {
        if (!rosterEvent) return [];
        return members.filter((member) => member.status === "active" &&
            (rosterEvent.section === "All Sections" || member.section === rosterEvent.section));
    }, [members, rosterEvent]);

    const openCreate = () => {
        setEditing(null); setDraft(emptyEvent); setMessage(""); setError(""); setEventDialogOpen(true);
    };

    const openEdit = (event: EventRecord) => {
        setEditing(event); setDraft(eventInput(event)); setMessage(""); setError(""); setEventDialogOpen(true);
    };

    const saveEvent = async () => {
        if (!draft.title.trim()) { setError("Event title is required."); return; }
        if (!draft.startDate) { setError("Start date is required."); return; }
        if (draft.endDate && draft.endDate < draft.startDate) { setError("End date cannot be before the start date."); return; }
        setSaving(true); setError("");
        try {
            if (editing) { await updateEvent(editing.id, draft); setMessage("Event updated."); }
            else { await createEvent(draft); setMessage("Event created."); }
            setEventDialogOpen(false); await load();
        } catch (saveError) {
            console.error("Unable to save event:", saveError); setError("Unable to save the event.");
        } finally { setSaving(false); }
    };

    const openRoster = (event: EventRecord) => {
        const nextAttendance: Record<string, AttendanceStatus> = {};
        const nextConsent: Record<string, EventConsentStatus> = {};
        members.filter((member) => member.status === "active" &&
            (event.section === "All Sections" || member.section === event.section)).forEach((member) => {
            nextAttendance[member.id] = event.attendance[member.id] || "invited";
            nextConsent[member.id] = event.consent[member.id] || (event.consentRequired ? "required" : "not-required");
        });
        setRosterEvent(event); setAttendance(nextAttendance); setConsent(nextConsent); setMessage(""); setError("");
    };

    const saveRoster = async () => {
        if (!rosterEvent) return;
        setSavingRoster(true); setError("");
        try {
            await updateEventRoster(rosterEvent.id, attendance, consent);
            setMessage("Attendance and consent roster updated."); setRosterEvent(null); await load();
        } catch (saveError) {
            console.error("Unable to save event roster:", saveError);
            setError("Unable to save the attendance and consent roster.");
        } finally { setSavingRoster(false); }
    };

    const printRoster = (event: EventRecord) => {
        const eventMembers = members.filter((member) => member.status === "active" &&
            (event.section === "All Sections" || member.section === event.section));
        const rows = eventMembers.map((member) => {
            const attendanceStatus = event.attendance[member.id] || "invited";
            const consentStatus = event.consent[member.id] || (event.consentRequired ? "required" : "not-required");
            return `<tr><td>${escapeHtml(member.displayName)}</td><td>${escapeHtml(member.section)}</td><td>${escapeHtml(attendanceLabel(attendanceStatus))}</td><td>${escapeHtml(consentLabel(consentStatus))}</td><td>${escapeHtml(member.parentName || "")}</td><td>${escapeHtml(member.mobileNumber || "")}</td></tr>`;
        }).join("");
        const printWindow = window.open("", "_blank", "width=1100,height=800");
        if (!printWindow) { window.alert("Please allow pop-ups for this site to print the event roster."); return; }
        printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(event.title)} - Event Roster</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#1f2937}h1{color:#081E67;margin-bottom:6px}.meta{margin-bottom:18px;color:#4b5563}.notes{padding:12px;border:1px solid #ddd;margin:14px 0;white-space:pre-wrap}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #d1d5db;padding:8px;text-align:left}th{background:#EEF1FA;color:#081E67}.controls{margin-bottom:20px}@media print{.controls{display:none}}</style></head><body><div class="controls"><button onclick="window.print()">Print / Save PDF</button></div><h1>${escapeHtml(event.title)}</h1><div class="meta">${escapeHtml(event.eventType)} · ${escapeHtml(event.section)} · ${escapeHtml(event.startDate)}${event.endDate ? ` to ${escapeHtml(event.endDate)}` : ""}${event.location ? ` · ${escapeHtml(event.location)}` : ""}</div>${event.meetingPoint ? `<div><strong>Meeting point:</strong> ${escapeHtml(event.meetingPoint)}</div>` : ""}${event.returnDetails ? `<div><strong>Return details:</strong> ${escapeHtml(event.returnDetails)}</div>` : ""}${event.leaderNotes ? `<div class="notes"><strong>Leader notes</strong><br/>${escapeHtml(event.leaderNotes)}</div>` : ""}<table><thead><tr><th>Member</th><th>Section</th><th>Attendance</th><th>Consent</th><th>Parent / Guardian</th><th>Phone</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
        printWindow.document.close();
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <LeaderPageHeader title="Events & Activities" description="Create camps, trips and activities, then manage attendance and event consent."
                    actions={<Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><Button variant="outlined" color="secondary" onClick={() => void load()}>Refresh</Button><Button variant="contained" color="success" onClick={openCreate}>Add Event</Button></Stack>} />

                {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
                    {[["Total", totals.total, "all"], ["Open", totals.open, "open"], ["Draft", totals.draft, "draft"], ["Completed", totals.completed, "completed"]].map(([label, value, filter]) => {
                        const active = statusFilter === filter;
                        return <Paper key={String(label)} variant="outlined" role="button" tabIndex={0} onClick={() => setStatusFilter(filter as EventStatus | "all")} sx={{ p: 2.5, textAlign: "center", cursor: "pointer", borderWidth: active ? 2 : 1, borderColor: active ? "secondary.main" : "divider" }}><Typography variant="h4" color="secondary">{value}</Typography><Typography color="text.secondary">{label}</Typography></Paper>;
                    })}
                </Box>

                <Paper elevation={2} sx={{ p: 3, mb: 3 }}><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 2 }}>
                    <TextField label="Search events" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, location, type..." />
                    <FormControl><InputLabel>Section</InputLabel><Select label="Section" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>{sections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}</Select></FormControl>
                    <FormControl><InputLabel>Status</InputLabel><Select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as EventStatus | "all")}><MenuItem value="all">All statuses</MenuItem>{statuses.map((status) => <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>)}</Select></FormControl>
                </Box></Paper>

                {loading ? <Box sx={{ minHeight: 300, display: "flex", justifyContent: "center", alignItems: "center" }}><CircularProgress color="success" /></Box> :
                    <Box sx={{ display: "grid", gap: 2 }}>{visibleEvents.length === 0 && <Alert severity="info">No events match the current filters.</Alert>}{visibleEvents.map((event) => {
                        const attending = Object.values(event.attendance).filter((value) => value === "attending").length;
                        const consentOutstanding = event.consentRequired ? Object.values(event.consent).filter((value) => value === "required").length : 0;
                        return <Paper key={event.id} variant="outlined" sx={{ p: 2.5 }}><Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, justifyContent: "space-between", gap: 2 }}><Box>
                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}><Typography variant="h5" color="secondary">{event.title}</Typography><Chip label={statusLabel(event.status)} color={statusColor(event.status)} size="small"/><Chip label={event.section} variant="outlined" size="small"/><Chip label={event.eventType} variant="outlined" size="small"/>{event.consentRequired && <Chip label="Consent required" color="warning" size="small"/>}{consentOutstanding > 0 && <Chip label={`${consentOutstanding} consent outstanding`} color="error" size="small"/>}</Stack>
                            <Typography sx={{ mt: 1.25 }}>{event.startDate || "No date"}{event.endDate && event.endDate !== event.startDate ? ` to ${event.endDate}` : ""}{event.location ? ` · ${event.location}` : ""}</Typography>
                            {event.meetingPoint && <Typography color="text.secondary" sx={{ mt: .5 }}>Meeting point: {event.meetingPoint}</Typography>}{event.returnDetails && <Typography color="text.secondary" sx={{ mt: .5 }}>Return: {event.returnDetails}</Typography>}{event.description && <Typography color="text.secondary" sx={{ mt: .75 }}>{event.description}</Typography>}<Typography color="text.secondary" sx={{ mt: .75 }}>{attending} member{attending === 1 ? "" : "s"} marked attending</Typography>
                        </Box><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><Button variant="outlined" color="secondary" onClick={() => printRoster(event)}>Print</Button><Button variant="outlined" color="secondary" onClick={() => openEdit(event)}>Edit</Button><Button variant="contained" color="success" onClick={() => openRoster(event)}>Roster</Button></Stack></Box></Paper>;
                    })}</Box>}

                <Dialog open={eventDialogOpen} onClose={() => setEventDialogOpen(false)} maxWidth="md" fullWidth><DialogTitle>{editing ? "Edit Event" : "Add Event"}</DialogTitle><DialogContent dividers><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                    <TextField required label="Event title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} sx={{ gridColumn: { md: "1 / -1" } }}/>
                    <FormControl><InputLabel>Event type</InputLabel><Select label="Event type" value={draft.eventType} onChange={(event) => setDraft({ ...draft, eventType: event.target.value })}>{eventTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</Select></FormControl>
                    <FormControl><InputLabel>Section</InputLabel><Select label="Section" value={draft.section} onChange={(event) => setDraft({ ...draft, section: event.target.value })}>{sections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}</Select></FormControl>
                    <TextField required type="date" label="Start date" value={draft.startDate} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}/><TextField type="date" label="End date" value={draft.endDate} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}/>
                    <TextField label="Location" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} sx={{ gridColumn: { md: "1 / -1" } }}/><TextField label="Meeting point / departure details" value={draft.meetingPoint} onChange={(event) => setDraft({ ...draft, meetingPoint: event.target.value })} sx={{ gridColumn: { md: "1 / -1" } }}/><TextField label="Return / collection details" value={draft.returnDetails} onChange={(event) => setDraft({ ...draft, returnDetails: event.target.value })} sx={{ gridColumn: { md: "1 / -1" } }}/>
                    <FormControl><InputLabel>Status</InputLabel><Select label="Status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as EventStatus })}>{statuses.map((status) => <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>)}</Select></FormControl><FormControlLabel control={<Switch checked={draft.consentRequired} onChange={(event) => setDraft({ ...draft, consentRequired: event.target.checked })}/>} label="Activity consent required"/>
                    <TextField label="Description" multiline minRows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} sx={{ gridColumn: { md: "1 / -1" } }}/><TextField label="Leader notes" multiline minRows={3} value={draft.leaderNotes} onChange={(event) => setDraft({ ...draft, leaderNotes: event.target.value })} helperText="Internal notes for leaders; included on the printed leader roster." sx={{ gridColumn: { md: "1 / -1" } }}/>
                </Box></DialogContent><DialogActions><Button onClick={() => setEventDialogOpen(false)}>Cancel</Button><Button variant="contained" color="success" disabled={saving} onClick={() => void saveEvent()}>{saving ? "Saving..." : "Save Event"}</Button></DialogActions></Dialog>

                <Dialog open={Boolean(rosterEvent)} onClose={() => setRosterEvent(null)} maxWidth="lg" fullWidth>{rosterEvent && <><DialogTitle>{rosterEvent.title} — Attendance & Consent</DialogTitle><DialogContent dividers>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 3 }}><Chip label={`${rosterMembers.length} active members`}/><Chip label={`${Object.values(attendance).filter((value) => value === "attending").length} attending`} color="success"/>{rosterEvent.consentRequired && <Chip label={`${Object.values(consent).filter((value) => value === "required").length} consent outstanding`} color="error"/>}</Stack>
                    {rosterMembers.length === 0 ? <Alert severity="info">No active members are available for this event section.</Alert> : <Stack spacing={1.5}>{rosterMembers.map((member) => <Paper key={member.id} variant="outlined" sx={{ p: 2 }}><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 2, alignItems: "center" }}><Box><Typography sx={{ fontWeight: 700 }}>{member.displayName}</Typography><Typography variant="body2" color="text.secondary">{member.section} · {member.parentName || "No parent / guardian"} · {member.mobileNumber || "No phone"}</Typography></Box><FormControl size="small"><InputLabel>Attendance</InputLabel><Select label="Attendance" value={attendance[member.id] || "invited"} onChange={(event) => setAttendance((current) => ({ ...current, [member.id]: event.target.value as AttendanceStatus }))}><MenuItem value="invited">Invited</MenuItem><MenuItem value="attending">Attending</MenuItem><MenuItem value="not-attending">Not attending</MenuItem></Select></FormControl><FormControl size="small" disabled={!rosterEvent.consentRequired}><InputLabel>Consent</InputLabel><Select label="Consent" value={consent[member.id] || (rosterEvent.consentRequired ? "required" : "not-required")} onChange={(event) => setConsent((current) => ({ ...current, [member.id]: event.target.value as EventConsentStatus }))}><MenuItem value="not-required">Not required</MenuItem><MenuItem value="required">Outstanding</MenuItem><MenuItem value="received">Received</MenuItem></Select></FormControl></Box></Paper>)}</Stack>}
                </DialogContent><DialogActions><Button onClick={() => printRoster({ ...rosterEvent, attendance, consent })}>Print</Button><Button onClick={() => setRosterEvent(null)}>Close</Button><Button variant="contained" color="success" disabled={savingRoster} onClick={() => void saveRoster()}>{savingRoster ? "Saving..." : "Save Roster"}</Button></DialogActions></>}</Dialog>
            </Container>
        </Box>
    );
}
