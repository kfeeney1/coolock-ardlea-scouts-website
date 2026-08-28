import { Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { Link } from "react-router-dom";

import type { MemberRecord } from "../../services/memberAdmin";
import type { EventRecord, EventStatus } from "../../services/eventAdmin";
import { EVENT_SECTIONS, EVENT_STATUSES, eventCounts, eventStatusLabel } from "../../services/eventManagementLogic";

type Props = {
    events: EventRecord[];
    visibleEvents: EventRecord[];
    members: MemberRecord[];
    loading: boolean;
    search: string;
    sectionFilter: string;
    statusFilter: EventStatus | "all";
    onSearchChange: (value: string) => void;
    onSectionFilterChange: (value: string) => void;
    onStatusFilterChange: (value: EventStatus | "all") => void;
    onEdit: (event: EventRecord) => void;
    onRoster: (event: EventRecord) => void;
    onPrint: (event: EventRecord) => void;
    onExport: (event: EventRecord) => void;
};

function statusColor(status: EventStatus): "default" | "success" | "warning" | "secondary" {
    if (status === "open") return "success";
    if (status === "closed") return "warning";
    if (status === "completed") return "secondary";
    return "default";
}

export default function EventListPanel({ events, visibleEvents, members, loading, search, sectionFilter, statusFilter, onSearchChange, onSectionFilterChange, onStatusFilterChange, onEdit, onRoster, onPrint, onExport }: Props) {
    const totals = {
        total: events.length,
        open: events.filter((event) => event.status === "open").length,
        draft: events.filter((event) => event.status === "draft").length,
        closed: events.filter((event) => event.status === "closed").length,
        completed: events.filter((event) => event.status === "completed").length
    };

    return <>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, minmax(0, 1fr))" }, gap: 2, mb: 3 }}>
            {[["Total", totals.total, "all"], ["Open", totals.open, "open"], ["Draft", totals.draft, "draft"], ["Closed", totals.closed, "closed"], ["Completed", totals.completed, "completed"]].map(([label, value, filter]) => {
                const active = statusFilter === filter;
                return <Paper key={String(label)} variant="outlined" role="button" tabIndex={0} onClick={() => onStatusFilterChange(filter as EventStatus | "all")} sx={{ p: 2.5, textAlign: "center", cursor: "pointer", borderWidth: active ? 2 : 1, borderColor: active ? "secondary.main" : "divider" }}>
                    <Typography variant="h4" color="secondary">{value}</Typography><Typography color="text.secondary">{label}</Typography>
                </Paper>;
            })}
        </Box>

        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 2 }}>
                <TextField label="Search events" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Title, location, type..." />
                <FormControl><InputLabel>Section</InputLabel><Select label="Section" value={sectionFilter} onChange={(event) => onSectionFilterChange(event.target.value)}>{EVENT_SECTIONS.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}</Select></FormControl>
                <FormControl><InputLabel>Status</InputLabel><Select label="Status" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as EventStatus | "all")}><MenuItem value="all">All statuses</MenuItem>{EVENT_STATUSES.map((status) => <MenuItem key={status} value={status}>{eventStatusLabel(status)}</MenuItem>)}</Select></FormControl>
            </Box>
        </Paper>

        {statusFilter === "completed" && <Alert severity="info" sx={{ mb: 3 }}>Completed events are retained as read-only history. Reports and CSV exports remain available.</Alert>}

        {loading ? <Box sx={{ minHeight: 300, display: "flex", justifyContent: "center", alignItems: "center" }}><CircularProgress color="success" /></Box> : <Box sx={{ display: "grid", gap: 2 }}>
            {visibleEvents.length === 0 && <Alert severity="info">No events match the current filters.</Alert>}
            {visibleEvents.map((event) => {
                const summary = eventCounts(event, members);
                const completed = event.status === "completed";
                return <Paper key={event.id} variant="outlined" sx={{ p: 2.5 }} data-testid={`event-card-${event.id}`}>
                    <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, justifyContent: "space-between", gap: 2 }}>
                        <Box sx={{ flex: 1 }}>
                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                                <Typography variant="h5" color="secondary">{event.title}</Typography><Chip label={eventStatusLabel(event.status)} color={statusColor(event.status)} size="small" /><Chip label={event.section} variant="outlined" size="small" /><Chip label={event.eventType} variant="outlined" size="small" />{completed && <Chip label="Read-only history" size="small" variant="outlined" />}
                            </Stack>
                            <Typography sx={{ mt: 1.25 }}>{event.startDate || "No date"}{event.endDate && event.endDate !== event.startDate ? ` to ${event.endDate}` : ""}{event.location ? ` · ${event.location}` : ""}</Typography>
                            {event.meetingPoint && <Typography color="text.secondary" sx={{ mt: 0.5 }}>Meeting point: {event.meetingPoint}</Typography>}
                            {event.returnDetails && <Typography color="text.secondary" sx={{ mt: 0.5 }}>Return: {event.returnDetails}</Typography>}
                            {event.description && <Typography color="text.secondary" sx={{ mt: 0.75 }}>{event.description}</Typography>}
                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1.5 }}>
                                <Chip label={`${summary.attending} attending`} size="small" color="success" /><Chip label={`${summary.notAttending} not attending`} size="small" variant="outlined" /><Chip label={`${summary.invited} invited`} size="small" variant="outlined" />
                                {event.consentRequired && <Chip label={`${summary.consentReceived} consent received`} size="small" color="success" variant="outlined" />}{event.consentRequired && summary.consentOutstanding > 0 && <Chip label={`${summary.consentOutstanding} consent outstanding`} size="small" color="error" />}
                            </Stack>
                        </Box>
                        <Stack direction={{ xs: "column", sm: "row", lg: "column" }} spacing={1.25} sx={{ minWidth: { lg: 150 } }}>
                            {event.consentRequired && <Button component={Link} to={`/leader/event-consent?eventId=${encodeURIComponent(event.id)}`} variant="contained" color="warning">Manage Consent</Button>}
                            <Button variant="outlined" color="secondary" onClick={() => onPrint(event)}>Report</Button><Button variant="outlined" color="secondary" onClick={() => onExport(event)}>Export CSV</Button><Button variant="outlined" color="secondary" disabled={completed} onClick={() => onEdit(event)}>Edit</Button><Button variant="contained" color={completed ? "secondary" : "success"} onClick={() => onRoster(event)}>{completed ? "View Attendance" : "Attendance"}</Button>
                        </Stack>
                    </Box>
                </Paper>;
            })}
        </Box>}
    </>;
}
