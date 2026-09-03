import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { buildMemberAttendanceHistory, buildMemberAttendanceInsights } from "../services/attendanceInsightsLogic";
import type { AttendanceInsightMember, AttendanceHistoryRow } from "../services/attendanceInsightsLogic";
import { loadAttendanceInsightMembers, loadEventReportRecords } from "../services/reporting";
import type { EventReportRecord } from "../services/reportingLogic";
import { buildScoutPeriods, findScoutPeriod } from "../services/scoutPeriods";
import { loadWeeklyAccess, loadWeeklyMeetings } from "../services/weeklyTracker";
import type { WeeklyMeetingRecord } from "../services/weeklyTracker";

function formatDate(value: string): string {
    if (!value) return "No recorded attendance";
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(parsed);
}

function statusLabel(status: AttendanceHistoryRow["status"]): string {
    if (status === "present" || status === "attending") return "Attended";
    if (status === "absent" || status === "not-attending") return "Did not attend";
    return "Unrecorded";
}

function rateLabel(rate: number | null): string {
    return rate === null ? "—" : `${rate}%`;
}

export default function AttendanceInsights() {
    const { adminProfile } = useAdminAuth();
    const [members, setMembers] = useState<AttendanceInsightMember[]>([]);
    const [events, setEvents] = useState<EventReportRecord[]>([]);
    const [meetings, setMeetings] = useState<WeeklyMeetingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sectionFilter, setSectionFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [periodFilter, setPeriodFilter] = useState("custom");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [historyType, setHistoryType] = useState<"meetings" | "events">("meetings");

    const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
    const sections = useMemo(() => adminProfile?.sections ?? [], [adminProfile?.sections]);
    const scope = useMemo(() => ({ isAdmin, sections }), [isAdmin, sections]);
    const dateRange = useMemo(() => ({ from: fromDate || undefined, to: toDate || undefined }), [fromDate, toDate]);
    const scoutPeriods = useMemo(() => buildScoutPeriods(), []);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            setLoading(true);
            setError("");
            try {
                const weeklyAccess = await loadWeeklyAccess();
                const [loadedMembers, loadedEvents, loadedMeetings] = await Promise.all([
                    loadAttendanceInsightMembers(scope),
                    loadEventReportRecords(scope),
                    loadWeeklyMeetings(sections, isAdmin, weeklyAccess.canViewAll)
                ]);
                if (!cancelled) {
                    setMembers(loadedMembers);
                    setEvents(loadedEvents);
                    setMeetings(loadedMeetings);
                }
            } catch (loadError) {
                console.error("Unable to load attendance insights:", loadError);
                if (!cancelled) setError("Unable to load attendance history for your permitted sections.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [scope, sections, isAdmin]);

    const insights = useMemo(
        () => buildMemberAttendanceInsights(members, events, meetings, dateRange),
        [members, events, meetings, dateRange]
    );
    const availableSections = useMemo(
        () => [...new Set(insights.map((item) => item.section).filter(Boolean))].sort(),
        [insights]
    );
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const visibleInsights = insights.filter((item) =>
        (sectionFilter === "all" || item.section === sectionFilter)
        && (!normalizedSearch || item.displayName.toLocaleLowerCase().includes(normalizedSearch))
    );
    const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;
    const selectedHistory = selectedMember ? buildMemberAttendanceHistory(selectedMember, events, meetings, dateRange) : null;
    const historyRows = selectedHistory?.[historyType] ?? [];

    const averageRate = (kind: "meeting" | "event" | "combined") => {
        const rates = visibleInsights.map((item) => item[kind].rate).filter((rate): rate is number => rate !== null);
        return rates.length > 0 ? Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length) : null;
    };

    const scopeLabel = isAdmin
        ? "All sections"
        : sections.length > 0
          ? sections.join(", ")
          : "No sections assigned";

    const invalidDateRange = Boolean(fromDate && toDate && fromDate > toDate);
    const hasActiveFilters = Boolean(
        search.trim()
        || sectionFilter !== "all"
        || periodFilter !== "custom"
        || fromDate
        || toDate
    );

    const applyPeriod = (periodId: string) => {
        setPeriodFilter(periodId);
        if (periodId === "custom") return;
        const period = findScoutPeriod(periodId);
        if (!period) return;
        setFromDate(period.from);
        setToDate(period.to);
    };

    const updateFromDate = (value: string) => {
        setPeriodFilter("custom");
        setFromDate(value);
    };

    const updateToDate = (value: string) => {
        setPeriodFilter("custom");
        setToDate(value);
    };

    const resetFilters = () => {
        setSearch("");
        setSectionFilter("all");
        setPeriodFilter("custom");
        setFromDate("");
        setToDate("");
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <LeaderPageHeader
                    title="Attendance History & Insights"
                    description="Search members, compare weekly meeting and event attendance, and review attendance over a selected Scout period or custom date range."
                />

                <Alert severity="info" sx={{ mb: 3 }}>
                    Scope: <strong>{scopeLabel}</strong>. Analytics use closed Weekly Meetings and completed events only.
                </Alert>
                {!isAdmin && sections.length === 0 && (
                    <Alert severity="warning" sx={{ mb: 3 }}>Your leader account has no sections assigned, so no attendance data can be loaded.</Alert>
                )}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                {invalidDateRange && <Alert severity="warning" sx={{ mb: 3 }}>The From date must be on or before the To date.</Alert>}

                {loading ? (
                    <Box sx={{ minHeight: 280, display: "grid", placeItems: "center" }}><CircularProgress color="success" /></Box>
                ) : selectedMember && selectedHistory ? (
                    <Stack spacing={2} data-testid="attendance-member-detail">
                        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                                <Box>
                                    <Typography variant="h4" color="secondary">{selectedMember.displayName}</Typography>
                                    <Typography color="text.secondary">{selectedMember.section} · Attendance history</Typography>
                                </Box>
                                <Button variant="outlined" onClick={() => setSelectedMemberId(null)}>Back to members</Button>
                            </Stack>
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 2.5 }}>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
                                <Button variant={historyType === "meetings" ? "contained" : "outlined"} onClick={() => setHistoryType("meetings")}>
                                    Meetings ({selectedHistory.meetings.length})
                                </Button>
                                <Button variant={historyType === "events" ? "contained" : "outlined"} onClick={() => setHistoryType("events")}>
                                    Events ({selectedHistory.events.length})
                                </Button>
                            </Stack>
                            {historyRows.length === 0 ? (
                                <Alert severity="info">No {historyType} attendance is recorded for this member in the selected date range.</Alert>
                            ) : (
                                <Stack spacing={1} data-testid="attendance-history-list">
                                    {historyRows.map((row) => (
                                        <Paper key={`${historyType}-${row.id}`} variant="outlined" sx={{ p: 2 }}>
                                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                                                <Box>
                                                    <Typography sx={{ fontWeight: 800 }}>{row.title}</Typography>
                                                    <Typography color="text.secondary">{formatDate(row.date)}</Typography>
                                                </Box>
                                                <Chip
                                                    label={statusLabel(row.status)}
                                                    color={row.status === "present" || row.status === "attending" ? "success" : row.status === "unrecorded" ? "default" : "warning"}
                                                    variant="outlined"
                                                />
                                            </Stack>
                                        </Paper>
                                    ))}
                                </Stack>
                            )}
                        </Paper>
                    </Stack>
                ) : (
                    <>
                        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(240px, 1fr) 200px 210px 175px 175px" }, gap: 2 }}>
                                <TextField label="Search members" value={search} onChange={(event) => setSearch(event.target.value)} slotProps={{ htmlInput: { "data-testid": "attendance-member-search" } }} />
                                <FormControl>
                                    <InputLabel id="attendance-section-filter-label">Section</InputLabel>
                                    <Select
                                        id="attendance-section-filter"
                                        labelId="attendance-section-filter-label"
                                        label="Section"
                                        value={sectionFilter}
                                        onChange={(event) => setSectionFilter(event.target.value)}
                                        data-testid="attendance-section-filter"
                                    >
                                        <MenuItem value="all">All permitted sections</MenuItem>
                                        {availableSections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <FormControl>
                                    <InputLabel id="attendance-period-filter-label">Scout period</InputLabel>
                                    <Select
                                        id="attendance-period-filter"
                                        labelId="attendance-period-filter-label"
                                        label="Scout period"
                                        value={periodFilter}
                                        onChange={(event) => applyPeriod(event.target.value)}
                                        data-testid="attendance-period-filter"
                                    >
                                        <MenuItem value="custom">Custom / all dates</MenuItem>
                                        {scoutPeriods.map((period) => <MenuItem key={period.id} value={period.id}>{period.label}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <TextField label="From" type="date" value={fromDate} onChange={(event) => updateFromDate(event.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { "data-testid": "attendance-from-date" } }} />
                                <TextField label="To" type="date" value={toDate} onChange={(event) => updateToDate(event.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { "data-testid": "attendance-to-date" } }} />
                            </Box>
                            {hasActiveFilters && (
                                <Button sx={{ mt: 2 }} size="small" variant="outlined" onClick={resetFilters} data-testid="attendance-reset-filters">
                                    Reset filters
                                </Button>
                            )}
                        </Paper>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2, mb: 3 }}>
                            <Paper variant="outlined" sx={{ p: 2.5 }} role="status" aria-live="polite" data-testid="attendance-result-count">
                                <Typography variant="h4" color="secondary">{visibleInsights.length}</Typography>
                                <Typography color="text.secondary">Matching active members</Typography>
                            </Paper>
                            <Paper variant="outlined" sx={{ p: 2.5 }} data-testid="meeting-average-rate"><Typography variant="h4" color="secondary">{rateLabel(averageRate("meeting"))}</Typography><Typography color="text.secondary">Average meeting attendance</Typography></Paper>
                            <Paper variant="outlined" sx={{ p: 2.5 }} data-testid="event-average-rate"><Typography variant="h4" color="secondary">{rateLabel(averageRate("event"))}</Typography><Typography color="text.secondary">Average event attendance</Typography></Paper>
                            <Paper variant="outlined" sx={{ p: 2.5 }} data-testid="combined-average-rate"><Typography variant="h4" color="secondary">{rateLabel(averageRate("combined"))}</Typography><Typography color="text.secondary">Average combined attendance</Typography></Paper>
                        </Box>

                        {invalidDateRange ? null : visibleInsights.length === 0 ? (
                            <Alert severity="info">No active members match the current search, section and date filters.</Alert>
                        ) : (
                            <Box sx={{ display: "grid", gap: 2 }}>
                                {visibleInsights.map((item) => (
                                    <Paper key={item.memberId} variant="outlined" sx={{ p: 2.5 }} data-testid="attendance-member-card">
                                        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, justifyContent: "space-between", gap: 2 }}>
                                            <Box>
                                                <Typography variant="h5" color="secondary">{item.displayName}</Typography>
                                                <Typography color="text.secondary">{item.section}</Typography>
                                                <Typography variant="body2" sx={{ mt: 1 }}>
                                                    Last recorded attendance: {formatDate(item.lastRecordedDate)}
                                                    {item.lastRecordedSource ? ` · ${item.lastRecordedSource === "meeting" ? "Weekly Meeting" : "Event"}` : ""}
                                                    {item.lastAttendanceStatus !== "unrecorded" ? ` · ${item.lastAttendanceStatus === "attended" ? "Attended" : "Did not attend"}` : ""}
                                                </Typography>
                                            </Box>
                                            <Stack spacing={1} sx={{ alignItems: { md: "flex-end" } }}>
                                                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", justifyContent: { md: "flex-end" } }}>
                                                    <Chip label={`Meetings ${rateLabel(item.meeting.rate)}`} color={item.meeting.rate !== null && item.meeting.rate < 60 ? "warning" : "default"} variant="outlined" />
                                                    <Chip label={`Events ${rateLabel(item.event.rate)}`} color={item.event.rate !== null && item.event.rate < 60 ? "warning" : "default"} variant="outlined" />
                                                    <Chip label={`Combined ${rateLabel(item.combined.rate)}`} color={item.combined.rate !== null && item.combined.rate < 60 ? "warning" : "success"} variant="outlined" />
                                                    <Chip label={`${item.combined.recorded} recorded · ${item.combined.unrecorded} unrecorded`} variant="outlined" />
                                                </Stack>
                                                <Button variant="outlined" onClick={() => { setSelectedMemberId(item.memberId); setHistoryType("meetings"); }}>
                                                    View attendance
                                                </Button>
                                            </Stack>
                                        </Box>
                                    </Paper>
                                ))}
                            </Box>
                        )}
                    </>
                )}
            </Container>
        </Box>
    );
}
