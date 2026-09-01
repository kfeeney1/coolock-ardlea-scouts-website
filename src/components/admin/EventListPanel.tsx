import { Alert, Box, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { Link } from "react-router-dom";

import type { MemberRecord } from "../../services/memberAdmin";
import type { EventRecord, EventStatus } from "../../services/eventAdmin";
import { EVENT_SECTIONS, EVENT_STATUSES, eventCounts, eventStatusLabel } from "../../services/eventManagementLogic";
import { moveToUiTargetAfterRender } from "../../services/uiTargeting";

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
};

function statusColor(status: EventStatus): "default" | "success" | "warning" | "secondary" {
    if (status === "open") return "success";
    if (status === "closed") return "warning";
    if (status === "completed") return "secondary";
    return "default";
}

export default function EventListPanel({ events, visibleEvents, members, loading, search, sectionFilter, statusFilter, onSearchChange, onSectionFilterChange, onStatusFilterChange }: Props) {
    const totals = {
        total: events.length,
        open: events.filter((event) => event.status === "open").length,
        draft: events.filter((event) => event.status === "draft").length,
        closed: events.filter((event) => event.status === "closed").length,
        completed: events.filter((event) => event.status === "completed").length
    };

    const selectStatus = (filter: EventStatus | "all") => {
        onStatusFilterChange(filter);
        moveToUiTargetAfterRender("event-results", { focus: true });
    };

    return <>
        <Box role="group" aria-label="Event status summary" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, minmax(0, 1fr))" }, gap: 2, mb: 3 }}>
            {[["Total", totals.total, "all"], ["Open", totals.open, "open"], ["Draft", totals.draft, "draft"], ["Closed", totals.closed, "closed"], ["Completed", totals.completed, "completed"]].map(([label, value, filter]) => {
                const filterValue = filter as EventStatus | "all";
                const active = statusFilter === filterValue;
                return <Paper key={String(label)} variant="outlined" role="button" tabIndex={0} aria-pressed={active} aria-controls="event-results"
                    onClick={() => selectStatus(filterValue)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectStatus(filterValue); } }}
                    sx={{ p: 2.5, textAlign: "center", cursor: "pointer", borderWidth: active ? 2 : 1, borderColor: active ? "secondary.main" : "divider", "&:focus-visible": { outline: "3px solid", outlineColor: "secondary.main", outlineOffset: 2 } }}>
                    <Typography variant="h4" color="secondary">{value}</Typography><Typography color="text.secondary">{label}</Typography>
                </Paper>;
            })}
        </Box>

        <Paper elevation={2} sx={{ p: 3, mb: 3 }}><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 2 }}>
            <TextField label="Search events" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Title, location, type..." />
            <FormControl><InputLabel id="event-section-filter-label">Section</InputLabel><Select labelId="event-section-filter-label" label="Section" value={sectionFilter} onChange={(event) => onSectionFilterChange(event.target.value)}>{EVENT_SECTIONS.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}</Select></FormControl>
            <FormControl><InputLabel id="event-status-filter-label">Status</InputLabel><Select labelId="event-status-filter-label" label="Status" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as EventStatus | "all")}><MenuItem value="all">All statuses</MenuItem>{EVENT_STATUSES.map((status) => <MenuItem key={status} value={status}>{eventStatusLabel(status)}</MenuItem>)}</Select></FormControl>
        </Box></Paper>

        {statusFilter === "completed" && <Alert severity="info" sx={{ mb: 3 }}>Completed events are retained as read-only history. Open an event to access reports, exports and its gallery.</Alert>}

        <Box id="event-results" role="region" aria-label="Event results" tabIndex={-1}>
            {loading ? <Box sx={{ minHeight: 300, display: "flex", justifyContent: "center", alignItems: "center" }}><CircularProgress color="success" /></Box> : <Box sx={{ display: "grid", gap: 2 }}>
                {visibleEvents.length === 0 && <Alert severity="info">No events match the current filters.</Alert>}
                {visibleEvents.map((event) => {
                    const summary = eventCounts(event, members);
                    const completed = event.status === "completed";
                    return <Paper key={event.id} component={Link} to={`/leader/events/${encodeURIComponent(event.id)}`} id={`event-${event.id}`} variant="outlined"
                        aria-label={`Open ${event.title}`} data-testid={`event-card-${event.id}`}
                        sx={{ p: 2.5, display: "block", color: "inherit", textDecoration: "none", cursor: "pointer", transition: "transform .15s ease, box-shadow .15s ease", "&:hover": { transform: "translateY(-2px)", boxShadow: 3 }, "&:focus-visible": { outline: "3px solid", outlineColor: "secondary.main", outlineOffset: 2 } }}>
                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                            <Typography variant="h5" color="secondary">{event.title}</Typography><Chip label={eventStatusLabel(event.status)} color={statusColor(event.status)} size="small" /><Chip label={event.section} variant="outlined" size="small" /><Chip label={event.eventType} variant="outlined" size="small" />{completed && <Chip label="Read-only history" size="small" variant="outlined" />}
                        </Stack>
                        <Typography sx={{ mt: 1.25 }}>{event.startDate || "No date"}{event.endDate && event.endDate !== event.startDate ? ` to ${event.endDate}` : ""}{event.location ? ` · ${event.location}` : ""}</Typography>
                        {event.description && <Typography color="text.secondary" sx={{ mt: 0.75 }}>{event.description}</Typography>}
                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1.5 }}>
                            <Chip label={`${summary.attending} attending`} size="small" color="success" /><Chip label={`${summary.notAttending} not attending`} size="small" variant="outlined" /><Chip label={`${summary.invited} invited`} size="small" variant="outlined" />
                            {event.consentRequired && <Chip label={`${summary.consentReceived} consent received`} size="small" color="success" variant="outlined" />}{event.consentRequired && summary.consentOutstanding > 0 && <Chip label={`${summary.consentOutstanding} consent outstanding`} size="small" color="error" />}
                        </Stack>
                        <Typography variant="body2" color="secondary" sx={{ mt: 1.5, fontWeight: 800 }}>Open event →</Typography>
                    </Paper>;
                })}
            </Box>}
        </Box>
    </>;
}
