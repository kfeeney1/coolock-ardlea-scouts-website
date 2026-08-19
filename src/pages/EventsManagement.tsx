import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";
import {
    createEvent,
    loadEvents,
    updateEvent,
    updateEventRoster
} from "../services/eventAdmin";
import type {
    AttendanceStatus,
    EventConsentStatus,
    EventInput,
    EventRecord,
    EventStatus
} from "../services/eventAdmin";

const sections = [
    "All Sections",
    "Beavers",
    "Cubs",
    "Scouts",
    "Ventures",
    "Rovers",
    "Group",
    "Other"
];

const eventTypes = [
    "Weekly Meeting",
    "Activity",
    "Day Trip",
    "Camp",
    "Hike",
    "Fundraiser",
    "Other"
];

const statuses: EventStatus[] = ["draft", "open", "closed", "completed"];

const emptyEvent: EventInput = {
    title: "",
    description: "",
    eventType: "Activity",
    section: "All Sections",
    location: "",
    meetingPoint: "",
    returnDetails: "",
    leaderNotes: "",
    startDate: "",
    endDate: "",
    status: "draft",
    consentRequired: false
};

function statusLabel(status: EventStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusColor(
    status: EventStatus
): "default" | "success" | "warning" | "secondary" {
    if (status === "open") return "success";
    if (status === "closed") return "warning";
    if (status === "completed") return "secondary";
    return "default";
}

function attendanceLabel(status: AttendanceStatus): string {
    if (status === "attending") return "Attending";
    if (status === "not-attending") return "Not attending";
    return "Invited";
}

function consentLabel(status: EventConsentStatus): string {
    if (status === "received") return "Received";
    if (status === "required") return "Outstanding";
    return "Not required";
}

function eventInput(record: EventRecord): EventInput {
    return {
        title: record.title,
        description: record.description,
        eventType: record.eventType,
        section: record.section,
        location: record.location,
        meetingPoint: record.meetingPoint,
        returnDetails: record.returnDetails,
        leaderNotes: record.leaderNotes,
        startDate: record.startDate,
        endDate: record.endDate,
        status: record.status,
        consentRequired: record.consentRequired
    };
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function csvCell(value: string): string {
    return `"${value.replaceAll('"', '""')}"`;
}

function eventMembers(event: EventRecord, members: MemberRecord[]): MemberRecord[] {
    return members.filter(
        (member) =>
            member.status === "active" &&
            (event.section === "All Sections" || member.section === event.section)
    );
}

function countsFor(event: EventRecord, members: MemberRecord[]) {
    const relevantMembers = eventMembers(event, members);
    let attending = 0;
    let notAttending = 0;
    let invited = 0;
    let consentReceived = 0;
    let consentOutstanding = 0;

    relevantMembers.forEach((member) => {
        const attendance = event.attendance[member.id] || "invited";
        const consent =
            event.consent[member.id] ||
            (event.consentRequired ? "required" : "not-required");

        if (attendance === "attending") attending += 1;
        else if (attendance === "not-attending") notAttending += 1;
        else invited += 1;

        if (consent === "received") consentReceived += 1;
        if (consent === "required") consentOutstanding += 1;
    });

    return {
        members: relevantMembers.length,
        attending,
        notAttending,
        invited,
        consentReceived,
        consentOutstanding
    };
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
        setLoading(true);
        setError("");

        try {
            const [loadedEvents, loadedMembers] = await Promise.all([
                loadEvents(),
                loadMembers()
            ]);
            setEvents(loadedEvents);
            setMembers(loadedMembers);
        } catch (loadError) {
            console.error("Unable to load events:", loadError);
            setError("Unable to load events and activities.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const visibleEvents = useMemo(() => {
        const query = search.trim().toLowerCase();

        return events.filter((event) => {
            if (
                sectionFilter !== "All Sections" &&
                event.section !== "All Sections" &&
                event.section !== sectionFilter
            ) {
                return false;
            }

            if (statusFilter !== "all" && event.status !== statusFilter) {
                return false;
            }

            if (!query) return true;

            return [
                event.title,
                event.description,
                event.location,
                event.meetingPoint,
                event.section,
                event.eventType
            ]
                .join(" ")
                .toLowerCase()
                .includes(query);
        });
    }, [events, search, sectionFilter, statusFilter]);

    const totals = useMemo(
        () => ({
            total: events.length,
            open: events.filter((event) => event.status === "open").length,
            draft: events.filter((event) => event.status === "draft").length,
            closed: events.filter((event) => event.status === "closed").length,
            completed: events.filter((event) => event.status === "completed").length
        }),
        [events]
    );

    const rosterMembers = useMemo(() => {
        if (!rosterEvent) return [];
        return eventMembers(rosterEvent, members);
    }, [members, rosterEvent]);

    const openCreate = () => {
        setEditing(null);
        setDraft(emptyEvent);
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
        if (!draft.title.trim()) {
            setError("Event title is required.");
            return;
        }

        if (!draft.startDate) {
            setError("Start date is required.");
            return;
        }

        if (draft.endDate && draft.endDate < draft.startDate) {
            setError("End date cannot be before the start date.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            if (editing) {
                await updateEvent(editing.id, draft);
                setMessage(
                    draft.status === "completed"
                        ? "Event completed and moved to history."
                        : "Event updated."
                );
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
            nextConsent[member.id] =
                event.consent[member.id] ||
                (event.consentRequired ? "required" : "not-required");
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
        const relevantMembers = eventMembers(event, members);
        const summary = countsFor(event, members);
        const rows = relevantMembers
            .map((member) => {
                const attendanceStatus = event.attendance[member.id] || "invited";
                const consentStatus =
                    event.consent[member.id] ||
                    (event.consentRequired ? "required" : "not-required");

                return `<tr><td>${escapeHtml(member.displayName)}</td><td>${escapeHtml(
                    member.section
                )}</td><td>${escapeHtml(attendanceLabel(attendanceStatus))}</td><td>${escapeHtml(
                    consentLabel(consentStatus)
                )}</td><td>${escapeHtml(member.parentName || "")}</td><td>${escapeHtml(
                    member.mobileNumber || ""
                )}</td><td>${escapeHtml(member.emergencyContactName || "")}</td><td>${escapeHtml(
                    member.emergencyContactPhone || ""
                )}</td></tr>`;
            })
            .join("");

        const printWindow = window.open("", "_blank", "width=1200,height=850");
        if (!printWindow) {
            window.alert("Please allow pop-ups for this site to print the event report.");
            return;
        }

        printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(
            event.title
        )} - Event Report</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#1f2937}h1{color:#081E67;margin-bottom:6px}.meta{margin-bottom:14px;color:#4b5563}.summary{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.summary span{border:1px solid #d1d5db;border-radius:6px;padding:7px 10px}.notes{padding:12px;border:1px solid #ddd;margin:14px 0;white-space:pre-wrap}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d1d5db;padding:7px;text-align:left}th{background:#EEF1FA;color:#081E67}.controls{margin-bottom:20px}@media print{.controls{display:none}}</style></head><body><div class="controls"><button onclick="window.print()">Print / Save PDF</button></div><h1>${escapeHtml(
            event.title
        )}</h1><div class="meta">${escapeHtml(event.eventType)} · ${escapeHtml(
            event.section
        )} · ${escapeHtml(event.startDate)}${event.endDate ? ` to ${escapeHtml(event.endDate)}` : ""}${
            event.location ? ` · ${escapeHtml(event.location)}` : ""
        } · ${escapeHtml(statusLabel(event.status))}</div><div class="summary"><span><strong>${
            summary.members
        }</strong> members</span><span><strong>${summary.attending}</strong> attending</span><span><strong>${
            summary.notAttending
        }</strong> not attending</span><span><strong>${summary.invited}</strong> invited</span><span><strong>${
            summary.consentReceived
        }</strong> consent received</span><span><strong>${
            summary.consentOutstanding
        }</strong> consent outstanding</span></div>${
            event.meetingPoint
                ? `<div><strong>Meeting point:</strong> ${escapeHtml(event.meetingPoint)}</div>`
                : ""
        }${
            event.returnDetails
                ? `<div><strong>Return details:</strong> ${escapeHtml(event.returnDetails)}</div>`
                : ""
        }${
            event.leaderNotes
                ? `<div class="notes"><strong>Leader notes</strong><br/>${escapeHtml(event.leaderNotes)}</div>`
                : ""
        }<table><thead><tr><th>Member</th><th>Section</th><th>Attendance</th><th>Consent</th><th>Parent / Guardian</th><th>Phone</th><th>Emergency Contact</th><th>Emergency Phone</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
        printWindow.document.close();
    };

    const exportRoster = (event: EventRecord) => {
        const summary = countsFor(event, members);
        const rows = eventMembers(event, members).map((member) => {
            const attendanceStatus = event.attendance[member.id] || "invited";
            const consentStatus =
                event.consent[member.id] ||
                (event.consentRequired ? "required" : "not-required");

            return [
                event.title,
                event.startDate,
                event.status,
                member.displayName,
                member.section,
                attendanceLabel(attendanceStatus),
                consentLabel(consentStatus),
                member.parentName || "",
                member.mobileNumber || "",
                member.emergencyContactName || "",
                member.emergencyContactPhone || ""
            ]
                .map((value) => csvCell(String(value)))
                .join(",");
        });

        const csv = [
            `Event summary,${csvCell(
                `${summary.attending} attending; ${summary.notAttending} not attending; ${summary.invited} invited; ${summary.consentReceived} consent received; ${summary.consentOutstanding} consent outstanding`
            )}`,
            "",
            [
                "Event",
                "Date",
                "Event Status",
                "Member",
                "Section",
                "Attendance",
                "Consent",
                "Parent / Guardian",
                "Phone",
                "Emergency Contact",
                "Emergency Phone"
            ]
                .map(csvCell)
                .join(","),
            ...rows
        ].join("\r\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${event.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "event"}-roster.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <LeaderPageHeader
                    title="Events & Activities"
                    description="Create camps, trips and activities, manage attendance and consent, and retain completed event history."
                    actions={
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <Button variant="outlined" color="secondary" onClick={() => void load()}>Refresh</Button>
                            <Button variant="contained" color="success" onClick={openCreate}>Add Event</Button>
                        </Stack>
                    }
                />

                {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, minmax(0, 1fr))" }, gap: 2, mb: 3 }}>
                    {[
                        ["Total", totals.total, "all"],
                        ["Open", totals.open, "open"],
                        ["Draft", totals.draft, "draft"],
                        ["Closed", totals.closed, "closed"],
                        ["Completed", totals.completed, "completed"]
                    ].map(([label, value, filter]) => {
                        const active = statusFilter === filter;
                        return (
                            <Paper key={String(label)} variant="outlined" role="button" tabIndex={0} onClick={() => setStatusFilter(filter as EventStatus | "all")} sx={{ p: 2.5, textAlign: "center", cursor: "pointer", borderWidth: active ? 2 : 1, borderColor: active ? "secondary.main" : "divider" }}>
                                <Typography variant="h4" color="secondary">{value}</Typography>
                                <Typography color="text.secondary">{label}</Typography>
                            </Paper>
                        );
                    })}
                </Box>

                <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 2 }}>
                        <TextField label="Search events" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, location, type..." />
                        <FormControl>
                            <InputLabel>Section</InputLabel>
                            <Select label="Section" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
                                {sections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl>
                            <InputLabel>Status</InputLabel>
                            <Select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as EventStatus | "all")}>
                                <MenuItem value="all">All statuses</MenuItem>
                                {statuses.map((status) => <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Box>
                </Paper>

                {statusFilter === "completed" && <Alert severity="info" sx={{ mb: 3 }}>Completed events are retained as read-only history. Reports and CSV exports remain available.</Alert>}

                {loading ? (
                    <Box sx={{ minHeight: 300, display: "flex", justifyContent: "center", alignItems: "center" }}><CircularProgress color="success" /></Box>
                ) : (
                    <Box sx={{ display: "grid", gap: 2 }}>
                        {visibleEvents.length === 0 && <Alert severity="info">No events match the current filters.</Alert>}
                        {visibleEvents.map((event) => {
                            const summary = countsFor(event, members);
                            const completed = event.status === "completed";
                            return (
                                <Paper key={event.id} variant="outlined" sx={{ p: 2.5 }}>
                                    <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, justifyContent: "space-between", gap: 2 }}>
                                        <Box sx={{ flex: 1 }}>
                                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                                                <Typography variant="h5" color="secondary">{event.title}</Typography>
                                                <Chip label={statusLabel(event.status)} color={statusColor(event.status)} size="small" />
                                                <Chip label={event.section} variant="outlined" size="small" />
                                                <Chip label={event.eventType} variant="outlined" size="small" />
                                                {completed && <Chip label="Read-only history" size="small" variant="outlined" />}
                                            </Stack>
                                            <Typography sx={{ mt: 1.25 }}>{event.startDate || "No date"}{event.endDate && event.endDate !== event.startDate ? ` to ${event.endDate}` : ""}{event.location ? ` · ${event.location}` : ""}</Typography>
                                            {event.meetingPoint && <Typography color="text.secondary" sx={{ mt: 0.5 }}>Meeting point: {event.meetingPoint}</Typography>}
                                            {event.returnDetails && <Typography color="text.secondary" sx={{ mt: 0.5 }}>Return: {event.returnDetails}</Typography>}
                                            {event.description && <Typography color="text.secondary" sx={{ mt: 0.75 }}>{event.description}</Typography>}
                                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1.5 }}>
                                                <Chip label={`${summary.attending} attending`} size="small" color="success" />
                                                <Chip label={`${summary.notAttending} not attending`} size="small" variant="outlined" />
                                                <Chip label={`${summary.invited} invited`} size="small" variant="outlined" />
                                                {event.consentRequired && <Chip label={`${summary.consentReceived} consent received`} size="small" color="success" variant="outlined" />}
                                                {event.consentRequired && summary.consentOutstanding > 0 && <Chip label={`${summary.consentOutstanding} consent outstanding`} size="small" color="error" />}
                                            </Stack>
                                        </Box>
                                        <Stack direction={{ xs: "column", sm: "row", lg: "column" }} spacing={1.25} sx={{ minWidth: { lg: 150 } }}>
                                            <Button variant="outlined" color="secondary" onClick={() => printRoster(event)}>Report</Button>
                                            <Button variant="outlined" color="secondary" onClick={() => exportRoster(event)}>Export CSV</Button>
                                            <Button variant="outlined" color="secondary" disabled={completed} onClick={() => openEdit(event)}>Edit</Button>
                                            <Button variant="contained" color={completed ? "secondary" : "success"} onClick={() => openRoster(event)}>{completed ? "View Roster" : "Roster"}</Button>
                                        </Stack>
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Box>
                )}

                <Dialog open={eventDialogOpen} onClose={() => setEventDialogOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle>{editing ? "Edit Event" : "Add Event"}</DialogTitle>
                    <DialogContent dividers>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                            <TextField required label="Event title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} sx={{ gridColumn: { md: "1 / -1" } }} />
                            <FormControl><InputLabel>Event type</InputLabel><Select label="Event type" value={draft.eventType} onChange={(event) => setDraft({ ...draft, eventType: event.target.value })}>{eventTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</Select></FormControl>
                            <FormControl><InputLabel>Section</InputLabel><Select label="Section" value={draft.section} onChange={(event) => setDraft({ ...draft, section: event.target.value })}>{sections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}</Select></FormControl>
                            <TextField required type="date" label="Start date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                            <TextField type="date" label="End date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                            <TextField label="Location" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
                            <FormControl><InputLabel>Status</InputLabel><Select label="Status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as EventStatus })}>{statuses.map((status) => <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>)}</Select></FormControl>
                            <TextField label="Meeting / departure details" value={draft.meetingPoint} onChange={(event) => setDraft({ ...draft, meetingPoint: event.target.value })} />
                            <TextField label="Return / collection details" value={draft.returnDetails} onChange={(event) => setDraft({ ...draft, returnDetails: event.target.value })} />
                            <TextField label="Description" multiline minRows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} sx={{ gridColumn: { md: "1 / -1" } }} />
                            <TextField label="Leader notes" multiline minRows={3} value={draft.leaderNotes} onChange={(event) => setDraft({ ...draft, leaderNotes: event.target.value })} helperText="Leader-only. Included on the leader event report." sx={{ gridColumn: { md: "1 / -1" } }} />
                            <FormControlLabel control={<Switch checked={draft.consentRequired} onChange={(event) => setDraft({ ...draft, consentRequired: event.target.checked })} />} label="Event consent required" sx={{ gridColumn: { md: "1 / -1" } }} />
                            {draft.status === "completed" && <Alert severity="warning" sx={{ gridColumn: { md: "1 / -1" } }}>Once saved as Completed, this event becomes read-only history. Reports and exports remain available.</Alert>}
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEventDialogOpen(false)}>Cancel</Button>
                        <Button variant="contained" color="success" disabled={saving} onClick={() => void saveEvent()}>{saving ? "Saving..." : "Save Event"}</Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={Boolean(rosterEvent)} onClose={() => setRosterEvent(null)} maxWidth="lg" fullWidth>
                    <DialogTitle>{rosterEvent?.status === "completed" ? "Event History Roster" : "Attendance & Consent Roster"}</DialogTitle>
                    <DialogContent dividers>
                        {rosterEvent?.status === "completed" && <Alert severity="info" sx={{ mb: 2 }}>This completed-event roster is read-only.</Alert>}
                        {rosterMembers.length === 0 ? <Alert severity="info">No active members are available for this event section.</Alert> : (
                            <Box sx={{ display: "grid", gap: 1.5 }}>
                                {rosterMembers.map((member) => {
                                    const readOnly = rosterEvent?.status === "completed";
                                    return (
                                        <Paper key={member.id} variant="outlined" sx={{ p: 2 }}>
                                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 2, alignItems: "center" }}>
                                                <Box><Typography sx={{ fontWeight: 700 }}>{member.displayName}</Typography><Typography variant="body2" color="text.secondary">{member.section}{member.parentName ? ` · ${member.parentName}` : ""}</Typography></Box>
                                                <FormControl size="small" disabled={readOnly}><InputLabel>Attendance</InputLabel><Select label="Attendance" value={attendance[member.id] || "invited"} onChange={(event) => setAttendance({ ...attendance, [member.id]: event.target.value as AttendanceStatus })}><MenuItem value="invited">Invited</MenuItem><MenuItem value="attending">Attending</MenuItem><MenuItem value="not-attending">Not attending</MenuItem></Select></FormControl>
                                                <FormControl size="small" disabled={readOnly}><InputLabel>Consent</InputLabel><Select label="Consent" value={consent[member.id] || (rosterEvent?.consentRequired ? "required" : "not-required")} onChange={(event) => setConsent({ ...consent, [member.id]: event.target.value as EventConsentStatus })}><MenuItem value="not-required">Not required</MenuItem><MenuItem value="required">Outstanding</MenuItem><MenuItem value="received">Received</MenuItem></Select></FormControl>
                                            </Box>
                                        </Paper>
                                    );
                                })}
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        {rosterEvent && <><Button color="secondary" onClick={() => printRoster(rosterEvent)}>Report</Button><Button color="secondary" onClick={() => exportRoster(rosterEvent)}>Export CSV</Button></>}
                        <Button onClick={() => setRosterEvent(null)}>Close</Button>
                        {rosterEvent?.status !== "completed" && <Button variant="contained" color="success" disabled={savingRoster} onClick={() => void saveRoster()}>{savingRoster ? "Saving..." : "Save Roster"}</Button>}
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
