import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    Container,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { buildMemberAttendanceInsights } from "../services/attendanceInsightsLogic";
import type { AttendanceInsightMember } from "../services/attendanceInsightsLogic";
import { loadAttendanceInsightMembers, loadEventReportRecords } from "../services/reporting";
import type { EventReportRecord } from "../services/reportingLogic";

function formatDate(value: string): string {
    if (!value) return "No recorded attendance";
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(parsed);
}

export default function AttendanceInsights() {
    const { adminProfile } = useAdminAuth();
    const [members, setMembers] = useState<AttendanceInsightMember[]>([]);
    const [events, setEvents] = useState<EventReportRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sectionFilter, setSectionFilter] = useState("all");

    const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
    const sections = adminProfile?.sections || [];
    const scope = useMemo(() => ({ isAdmin, sections }), [isAdmin, sections]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            setLoading(true);
            setError("");
            try {
                const [loadedMembers, loadedEvents] = await Promise.all([
                    loadAttendanceInsightMembers(scope),
                    loadEventReportRecords(scope)
                ]);
                if (!cancelled) {
                    setMembers(loadedMembers);
                    setEvents(loadedEvents);
                }
            } catch (loadError) {
                console.error("Unable to load attendance insights:", loadError);
                if (!cancelled) setError("Unable to load attendance history for your permitted sections.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [scope]);

    const insights = useMemo(
        () => buildMemberAttendanceInsights(members, events),
        [members, events]
    );
    const availableSections = useMemo(
        () => [...new Set(insights.map((item) => item.section).filter(Boolean))].sort(),
        [insights]
    );
    const visibleInsights = sectionFilter === "all"
        ? insights
        : insights.filter((item) => item.section === sectionFilter);
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
                    description="Review attendance recorded on completed events, with section-scoped member summaries and recent history indicators."
                />

                <Alert severity="info" sx={{ mb: 3 }}>
                    Scope: <strong>{scopeLabel}</strong>. Insights use completed events only; invited or unfinished-event responses are not counted as historical attendance.
                </Alert>
                {!isAdmin && sections.length === 0 && (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        Your leader account has no sections assigned, so no attendance data can be loaded.
                    </Alert>
                )}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                {loading ? (
                    <Box sx={{ minHeight: 280, display: "grid", placeItems: "center" }}>
                        <CircularProgress color="success" />
                    </Box>
                ) : (
                    <>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 2, mb: 3 }}>
                            <Paper variant="outlined" sx={{ p: 2.5 }}>
                                <Typography variant="h4" color="secondary">{completedEvents}</Typography>
                                <Typography color="text.secondary">Completed events in scope</Typography>
                            </Paper>
                            <Paper variant="outlined" sx={{ p: 2.5 }}>
                                <Typography variant="h4" color="secondary">{visibleInsights.length}</Typography>
                                <Typography color="text.secondary">Active members</Typography>
                            </Paper>
                            <Paper variant="outlined" sx={{ p: 2.5 }}>
                                <Typography variant="h4" color="secondary">{averageRate === null ? "—" : `${averageRate}%`}</Typography>
                                <Typography color="text.secondary">Average recorded attendance</Typography>
                            </Paper>
                        </Box>

                        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
                            <FormControl sx={{ minWidth: 240 }}>
                                <InputLabel>Section</InputLabel>
                                <Select label="Section" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
                                    <MenuItem value="all">All permitted sections</MenuItem>
                                    {availableSections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Paper>

                        {visibleInsights.length === 0 ? (
                            <Alert severity="info">No active members are available in the selected scope.</Alert>
                        ) : (
                            <Box sx={{ display: "grid", gap: 2 }}>
                                {visibleInsights.map((item) => (
                                    <Paper key={item.memberId} variant="outlined" sx={{ p: 2.5 }}>
                                        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, justifyContent: "space-between", gap: 2 }}>
                                            <Box>
                                                <Typography variant="h5" color="secondary">{item.displayName}</Typography>
                                                <Typography color="text.secondary">{item.section}</Typography>
                                                <Typography variant="body2" sx={{ mt: 1 }}>
                                                    Last recorded: {formatDate(item.lastRecordedDate)}
                                                    {item.lastAttendanceStatus !== "unrecorded" ? ` · ${item.lastAttendanceStatus === "attending" ? "Attending" : "Not attending"}` : ""}
                                                </Typography>
                                            </Box>
                                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignContent: "flex-start" }}>
                                                <Chip label={`${item.attended} attending`} color="success" variant="outlined" />
                                                <Chip label={`${item.notAttended} not attending`} variant="outlined" />
                                                <Chip label={`${item.unrecorded} unrecorded`} variant="outlined" />
                                                <Chip label={item.attendanceRate === null ? "No recorded rate" : `${item.attendanceRate}% recorded attendance`} color={item.attendanceRate !== null && item.attendanceRate < 60 ? "warning" : "default"} />
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
