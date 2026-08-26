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

export default function AttendanceInsights() {
    const { adminProfile } = useAdminAuth();
    const [members, setMembers] = useState<AttendanceInsightMember[]>([]);
    const [events, setEvents] = useState<EventReportRecord[]>([]);
    const [meetings, setMeetings] = useState<WeeklyMeetingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sectionFilter, setSectionFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [historyType, setHistoryType] = useState<"meetings" | "events">("meetings");

    const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
    const sections = useMemo(() => adminProfile?.sections ?? [], [adminProfile?.sections]);
    const scope = useMemo(() => ({ isAdmin, sections }), [isAdmin, sections]);

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

    const insights = useMemo(() => buildMemberAttendanceInsights(members, events), [members, events]);
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
    const selectedHistory = selectedMember ? buildMemberAttendanceHistory(selectedMember, events, meetings) : null;
    const historyRows = selectedHistory?.[historyType] ?? [];
    const completedEvents = events.filter((event) => event.status === "completed").length;
    const withRecordedAttendance = visibleInsights.filter((item) => item.attendanceRate !== null);
    const averageRate = withRecordedAttendance.length > 0
        ? Math.round(withRecordedAttendance.reduce((sum, item) => sum + (item.attendanceRate || 0), 0) / withRecordedAttendance.length)
        : null;

    const scopeLabel = isAdmin
        ? "All sections"
        : sections.length > 0
          ? sections.join(", ")
          : "No sections assigned";

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <LeaderPageHeader
                    title="Attendance History & Insights"
                    description="Search members, review attendance summaries, and open a member to see their meeting or event attendance history."
                />

                <Alert severity="info" sx={{ mb: 3 }}>
                    Scope: <strong>{scopeLabel}</strong>. Event insights use completed events only; weekly history uses closed meetings only.
                </Alert>
                {!isAdmin && sections.length === 0 && (
                    <Alert severity="warning" sx={{ mb: 3 }}>Your leader account has no sections assigned, so no attendance data can be loaded.</Alert>
                )}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

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
                                <Alert severity="info">No {historyType} attendance is recorded for this member.</Alert>
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
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 2, mb: 3 }}>
                            <Paper variant="outlined" sx={{ p: 2.5 }}><Typography variant="h4" color="secondary">{completedEvents}</Typography><Typography color="text.secondary">Completed events in scope</Typography></Paper>
                            <Paper variant="outlined" sx={{ p: 2.5 }}><Typography variant="h4" color="secondary">{visibleInsights.length}</Typography><Typography color="text.secondary">Matching active members</Typography></Paper>
                            <Paper variant="outlined" sx={{ p: 2.5 }}><Typography variant="h4" color="secondary">{averageRate === null ? "—" : `${averageRate}%`}</Typography><Typography color="text.secondary">Average recorded event attendance</Typography></Paper>
                        </Box>

                        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(280px, 1fr) 280px" }, gap: 2 }}>
                                <TextField label="Search members" value={search} onChange={(event) => setSearch(event.target.value)} slotProps={{ htmlInput: { "data-testid": "attendance-member-search" } }} />
                                <FormControl>
                                    <InputLabel>Section</InputLabel>
                                    <Select label="Section" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
                                        <MenuItem value="all">All permitted sections</MenuItem>
                                        {availableSections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Box>
                        </Paper>

                        {visibleInsights.length === 0 ? (
                            <Alert severity="info">No active members match the current search and section filters.</Alert>
                        ) : (
                            <Box sx={{ display: "grid", gap: 2 }}>
                                {visibleInsights.map((item) => (
                                    <Paper key={item.memberId} variant="outlined" sx={{ p: 2.5 }} data-testid="attendance-member-card">
                                        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, justifyContent: "space-between", gap: 2 }}>
                                            <Box>
                                                <Typography variant="h5" color="secondary">{item.displayName}</Typography>
                                                <Typography color="text.secondary">{item.section}</Typography>
                                                <Typography variant="body2" sx={{ mt: 1 }}>
                                                    Last recorded event: {formatDate(item.lastRecordedDate)}
                                                    {item.lastAttendanceStatus !== "unrecorded" ? ` · ${item.lastAttendanceStatus === "attending" ? "Attending" : "Not attending"}` : ""}
                                                </Typography>
                                            </Box>
                                            <Stack spacing={1} sx={{ alignItems: { md: "flex-end" } }}>
                                                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", justifyContent: { md: "flex-end" } }}>
                                                    <Chip label={`${item.attended} attending`} color="success" variant="outlined" />
                                                    <Chip label={`${item.notAttended} not attending`} variant="outlined" />
                                                    <Chip label={`${item.unrecorded} unrecorded`} variant="outlined" />
                                                    <Chip label={item.attendanceRate === null ? "No recorded rate" : `${item.attendanceRate}% recorded attendance`} color={item.attendanceRate !== null && item.attendanceRate < 60 ? "warning" : "default"} />
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
