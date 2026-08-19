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
    updateEventAttendance
} from "../services/eventAdmin";
import type {
    AttendanceStatus,
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

const statuses: EventStatus[] = [
    "draft",
    "open",
    "closed",
    "completed"
];

const emptyEvent: EventInput = {
    title: "",
    description: "",
    eventType: "Activity",
    section: "All Sections",
    location: "",
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

function eventInput(record: EventRecord): EventInput {
    return {
        title: record.title,
        description: record.description,
        eventType: record.eventType,
        section: record.section,
        location: record.location,
        startDate: record.startDate,
        endDate: record.endDate,
        status: record.status,
        consentRequired: record.consentRequired
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
    const [savingAttendance, setSavingAttendance] = useState(false);

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
            completed: events.filter((event) => event.status === "completed").length
        }),
        [events]
    );

    const rosterMembers = useMemo(() => {
        if (!rosterEvent) return [];

        return members.filter(
            (member) =>
                member.status === "active" &&
                (rosterEvent.section === "All Sections" ||
                    member.section === rosterEvent.section)
        );
    }, [members, rosterEvent]);

    const openCreate = () => {
        setEditing(null);
        setDraft(emptyEvent);
        setMessage("");
        setError("");
        setEventDialogOpen(true);
    };

    const openEdit = (event: EventRecord) => {
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
                setMessage("Event updated.");
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
        const initialAttendance: Record<string, AttendanceStatus> = {};

        members
            .filter(
                (member) =>
                    member.status === "active" &&
                    (event.section === "All Sections" || member.section === event.section)
            )
            .forEach((member) => {
                initialAttendance[member.id] = event.attendance[member.id] || "invited";
            });

        setRosterEvent(event);
        setAttendance(initialAttendance);
        setMessage("");
        setError("");
    };

    const saveAttendance = async () => {
        if (!rosterEvent) return;

        setSavingAttendance(true);
        setError("");

        try {
            await updateEventAttendance(rosterEvent.id, attendance);
            setMessage("Attendance roster updated.");
            setRosterEvent(null);
            await load();
        } catch (saveError) {
            console.error("Unable to save attendance:", saveError);
            setError("Unable to save the attendance roster.");
        } finally {
            setSavingAttendance(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: "100vh",
                backgroundColor: "background.default",
                py: { xs: 4, md: 6 }
            }}
        >
            <Container maxWidth="xl">
                <LeaderDashboardHeader />

                <LeaderPageHeader
                    title="Events & Activities"
                    description="Create camps, trips and activities, then manage the member attendance roster."
                    actions={
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <Button variant="outlined" color="secondary" onClick={() => void load()}>
                                Refresh
                            </Button>
                            <Button variant="contained" color="success" onClick={openCreate}>
                                Add Event
                            </Button>
                        </Stack>
                    }
                />

                {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
                        gap: 2,
                        mb: 3
                    }}
                >
                    {[
                        ["Total", totals.total, "all"],
                        ["Open", totals.open, "open"],
                        ["Draft", totals.draft, "draft"],
                        ["Completed", totals.completed, "completed"]
                    ].map(([label, value, filter]) => {
                        const active = statusFilter === filter;

                        return (
                            <Paper
                                key={String(label)}
                                variant="outlined"
                                role="button"
                                tabIndex={0}
                                onClick={() => setStatusFilter(filter as EventStatus | "all")}
                                sx={{
                                    p: 2.5,
                                    textAlign: "center",
                                    cursor: "pointer",
                                    borderWidth: active ? 2 : 1,
                                    borderColor: active ? "secondary.main" : "divider"
                                }}
                            >
                                <Typography variant="h4" color="secondary">{value}</Typography>
                                <Typography color="text.secondary">{label}</Typography>
                            </Paper>
                        );
                    })}
                </Box>

                <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" },
                            gap: 2
                        }}
                    >
                        <TextField
                            label="Search events"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Title, location, type..."
                        />

                        <FormControl>
                            <InputLabel>Section</InputLabel>
                            <Select
                                label="Section"
                                value={sectionFilter}
                                onChange={(event) => setSectionFilter(event.target.value)}
                            >
                                {sections.map((section) => (
                                    <MenuItem key={section} value={section}>{section}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl>
                            <InputLabel>Status</InputLabel>
                            <Select
                                label="Status"
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value as EventStatus | "all")
                                }
                            >
                                <MenuItem value="all">All statuses</MenuItem>
                                {statuses.map((status) => (
                                    <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </Paper>

                {loading ? (
                    <Box sx={{ minHeight: 300, display: "flex", justifyContent: "center", alignItems: "center" }}>
                        <CircularProgress color="success" />
                    </Box>
                ) : (
                    <Box sx={{ display: "grid", gap: 2 }}>
                        {visibleEvents.length === 0 && (
                            <Alert severity="info">No events match the current filters.</Alert>
                        )}

                        {visibleEvents.map((event) => {
                            const attending = Object.values(event.attendance).filter(
                                (status) => status === "attending"
                            ).length;

                            return (
                                <Paper key={event.id} variant="outlined" sx={{ p: 2.5 }}>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            flexDirection: { xs: "column", lg: "row" },
                                            justifyContent: "space-between",
                                            gap: 2
                                        }}
                                    >
                                        <Box>
                                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                                                <Typography variant="h5" color="secondary">{event.title}</Typography>
                                                <Chip label={statusLabel(event.status)} color={statusColor(event.status)} size="small" />
                                                <Chip label={event.section} variant="outlined" size="small" />
                                                <Chip label={event.eventType} variant="outlined" size="small" />
                                                {event.consentRequired && <Chip label="Consent required" color="warning" size="small" />}
                                            </Stack>

                                            <Typography sx={{ mt: 1.25 }}>
                                                {event.startDate || "No date"}
                                                {event.endDate && event.endDate !== event.startDate ? ` to ${event.endDate}` : ""}
                                                {event.location ? ` · ${event.location}` : ""}
                                            </Typography>

                                            {event.description && (
                                                <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                                                    {event.description}
                                                </Typography>
                                            )}

                                            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                                                {attending} member{attending === 1 ? "" : "s"} marked attending
                                            </Typography>
                                        </Box>

                                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                            <Button variant="outlined" color="secondary" onClick={() => openEdit(event)}>
                                                Edit
                                            </Button>
                                            <Button variant="contained" color="success" onClick={() => openRoster(event)}>
                                                Attendance
                                            </Button>
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
                            <TextField
                                required
                                label="Event title"
                                value={draft.title}
                                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                                sx={{ gridColumn: { md: "1 / -1" } }}
                            />

                            <FormControl>
                                <InputLabel>Event type</InputLabel>
                                <Select
                                    label="Event type"
                                    value={draft.eventType}
                                    onChange={(event) => setDraft({ ...draft, eventType: event.target.value })}
                                >
                                    {eventTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                                </Select>
                            </FormControl>

                            <FormControl>
                                <InputLabel>Section</InputLabel>
                                <Select
                                    label="Section"
                                    value={draft.section}
                                    onChange={(event) => setDraft({ ...draft, section: event.target.value })}
                                >
                                    {sections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}
                                </Select>
                            </FormControl>

                            <TextField
                                required
                                type="date"
                                label="Start date"
                                value={draft.startDate}
                                slotProps={{ inputLabel: { shrink: true } }}
                                onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
                            />

                            <TextField
                                type="date"
                                label="End date"
                                value={draft.endDate}
                                slotProps={{ inputLabel: { shrink: true } }}
                                onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
                            />

                            <TextField
                                label="Location"
                                value={draft.location}
                                onChange={(event) => setDraft({ ...draft, location: event.target.value })}
                                sx={{ gridColumn: { md: "1 / -1" } }}
                            />

                            <FormControl>
                                <InputLabel>Status</InputLabel>
                                <Select
                                    label="Status"
                                    value={draft.status}
                                    onChange={(event) => setDraft({ ...draft, status: event.target.value as EventStatus })}
                                >
                                    {statuses.map((status) => <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>)}
                                </Select>
                            </FormControl>

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={draft.consentRequired}
                                        onChange={(event) => setDraft({ ...draft, consentRequired: event.target.checked })}
                                    />
                                }
                                label="Activity consent required"
                            />

                            <TextField
                                multiline
                                minRows={4}
                                label="Description / notes"
                                value={draft.description}
                                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                                sx={{ gridColumn: { md: "1 / -1" } }}
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEventDialogOpen(false)}>Cancel</Button>
                        <Button variant="contained" color="success" disabled={saving} onClick={() => void saveEvent()}>
                            {saving ? "Saving..." : editing ? "Save Event" : "Create Event"}
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={Boolean(rosterEvent)} onClose={() => setRosterEvent(null)} maxWidth="md" fullWidth>
                    <DialogTitle>Attendance — {rosterEvent?.title}</DialogTitle>
                    <DialogContent dividers>
                        {rosterMembers.length === 0 ? (
                            <Alert severity="info">No active members are available for this event section.</Alert>
                        ) : (
                            <Stack spacing={1.5}>
                                {rosterMembers.map((member) => (
                                    <Paper key={member.id} variant="outlined" sx={{ p: 2 }}>
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" },
                                                gap: 2,
                                                alignItems: "center"
                                            }}
                                        >
                                            <Box>
                                                <Typography sx={{ fontWeight: 700 }}>{member.displayName}</Typography>
                                                <Typography variant="body2" color="text.secondary">{member.section}</Typography>
                                            </Box>

                                            <FormControl size="small">
                                                <InputLabel>Attendance</InputLabel>
                                                <Select
                                                    label="Attendance"
                                                    value={attendance[member.id] || "invited"}
                                                    onChange={(event) =>
                                                        setAttendance({
                                                            ...attendance,
                                                            [member.id]: event.target.value as AttendanceStatus
                                                        })
                                                    }
                                                >
                                                    {(["invited", "attending", "not-attending"] as AttendanceStatus[]).map(
                                                        (status) => (
                                                            <MenuItem key={status} value={status}>{attendanceLabel(status)}</MenuItem>
                                                        )
                                                    )}
                                                </Select>
                                            </FormControl>
                                        </Box>
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setRosterEvent(null)}>Cancel</Button>
                        <Button
                            variant="contained"
                            color="success"
                            disabled={savingAttendance || rosterMembers.length === 0}
                            onClick={() => void saveAttendance()}
                        >
                            {savingAttendance ? "Saving..." : "Save Attendance"}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
