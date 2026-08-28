import {
    Alert,
    Box,
    Button,
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
import { recordAuditEvent } from "../services/auditLog";
import { loadEventReportMembers, loadEventReportRecords, loadMemberReportRows } from "../services/reporting";
import type { EventReportRecord, MemberReportRow } from "../services/reportingLogic";
import {
    attendanceTrendCsv,
    buildReportingInsights,
    eventOverviewCsv,
    eventRosterCsv,
    filterEventsByDateRange,
    memberReportCsv,
    membershipSummaryCsv,
    outstandingConsentCsv,
    slug
} from "../services/reportingLogic";

function downloadCsv(filename: string, csv: string) {
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export default function LeaderReports() {
    const { adminProfile } = useAdminAuth();
    const [members, setMembers] = useState<MemberReportRow[]>([]);
    const [events, setEvents] = useState<EventReportRecord[]>([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [loading, setLoading] = useState(true);
    const [exportingEvent, setExportingEvent] = useState(false);
    const [error, setError] = useState("");

    const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
    const sections = adminProfile?.sections || [];
    const scope = useMemo(() => ({ isAdmin, sections }), [isAdmin, sections]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            setLoading(true);
            setError("");
            try {
                const [memberRows, eventRows] = await Promise.all([loadMemberReportRows(scope), loadEventReportRecords(scope)]);
                if (!cancelled) {
                    setMembers(memberRows);
                    setEvents(eventRows);
                    setSelectedEventId((current) => current || eventRows[0]?.id || "");
                }
            } catch (loadError) {
                console.error("Unable to load reporting data:", loadError);
                if (!cancelled) setError("Unable to load reporting data for your permitted sections.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [scope]);

    const filteredEvents = useMemo(() => filterEventsByDateRange(events, fromDate, toDate), [events, fromDate, toDate]);
    const insights = useMemo(() => buildReportingInsights(members, filteredEvents), [members, filteredEvents]);

    useEffect(() => {
        if (selectedEventId && filteredEvents.some((event) => event.id === selectedEventId)) return;
        setSelectedEventId(filteredEvents[0]?.id || "");
    }, [filteredEvents, selectedEventId]);

    const selectedEvent = filteredEvents.find((event) => event.id === selectedEventId) || null;
    const scopeLabel = isAdmin ? "All sections" : sections.length > 0 ? sections.join(", ") : "No sections assigned";
    const activeMembers = members.filter((member) => member.status === "active").length;
    const consentEvents = filteredEvents.filter((event) => event.consentRequired).length;
    const dateRangeLabel = fromDate || toDate ? `${fromDate || "Any date"} to ${toDate || "Any date"}` : "All dates";

    const auditExport = (action: string, targetId: string, targetLabel: string, description: string, section = scopeLabel) =>
        recordAuditEvent({ category: "system", action, targetId, targetLabel, description, section });

    const exportMembers = async () => {
        if (members.length === 0) return;
        downloadCsv(`member-report-${new Date().toISOString().slice(0, 10)}.csv`, memberReportCsv(members));
        await auditExport("Member report exported", "member-report", "Member report", `Exported ${members.length} member rows. Export excludes date of birth, medical and emergency-contact fields.`);
    };

    const exportMembershipSummary = async () => {
        if (members.length === 0) return;
        downloadCsv(`membership-summary-${new Date().toISOString().slice(0, 10)}.csv`, membershipSummaryCsv(members));
        await auditExport("Membership summary exported", "membership-summary", "Membership summary", `Exported membership totals for ${members.length} records in the permitted scope.`);
    };

    const exportEventOverview = async () => {
        if (filteredEvents.length === 0) return;
        downloadCsv(`event-overview-${new Date().toISOString().slice(0, 10)}.csv`, eventOverviewCsv(filteredEvents));
        await auditExport("Event overview exported", "event-overview", "Event overview", `Exported summary totals for ${filteredEvents.length} events in date range ${dateRangeLabel}.`);
    };

    const exportAttendanceTrends = async () => {
        if (filteredEvents.length === 0) return;
        downloadCsv(`attendance-trends-${new Date().toISOString().slice(0, 10)}.csv`, attendanceTrendCsv(filteredEvents));
        await auditExport("Attendance trends exported", "attendance-trends", "Attendance trends", `Exported attendance trends for ${filteredEvents.length} events in date range ${dateRangeLabel}.`);
    };

    const printSummary = async () => {
        await auditExport("Report summary printed", "reports-print", "Reports summary", `Opened print view for report scope ${scopeLabel} and date range ${dateRangeLabel}.`);
        window.print();
    };

    const withSelectedEventMembers = async (kind: "roster" | "consent") => {
        if (!selectedEvent) return;
        setExportingEvent(true);
        setError("");
        try {
            const eventMembers = await loadEventReportMembers(selectedEvent, scope);
            if (kind === "roster") {
                downloadCsv(`${slug(selectedEvent.title)}-attendance-consent.csv`, eventRosterCsv(selectedEvent, eventMembers));
                await auditExport("Event report exported", selectedEvent.id, selectedEvent.title, `Exported attendance and consent status for ${eventMembers.length} active members.`, selectedEvent.section);
            } else {
                downloadCsv(`${slug(selectedEvent.title)}-outstanding-consent.csv`, outstandingConsentCsv(selectedEvent, eventMembers));
                await auditExport("Outstanding consent report exported", selectedEvent.id, selectedEvent.title, "Exported members whose consent is still outstanding for this event.", selectedEvent.section);
            }
        } catch (exportError) {
            console.error("Unable to export event report:", exportError);
            setError("Unable to export that event report.");
        } finally {
            setExportingEvent(false);
        }
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <LeaderPageHeader title="Reports & Exports" description="Review operational insights and download reports limited to the records your leader account is permitted to access." />

                <Alert severity="info" sx={{ mb: 3 }}>Report scope: <strong>{scopeLabel}</strong>. Default exports deliberately exclude medical details, date of birth and emergency-contact information.</Alert>
                {!isAdmin && sections.length === 0 && <Alert severity="warning" sx={{ mb: 3 }}>Your leader account has no sections assigned, so no report data can be loaded.</Alert>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                {loading ? <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}><CircularProgress color="success" /></Box> : (
                    <Stack spacing={3}>
                        <Paper variant="outlined" sx={{ p: 2.5 }} data-testid="report-date-filter">
                            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
                                <TextField label="From date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                                <TextField label="To date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                                <Button variant="outlined" onClick={() => { setFromDate(""); setToDate(""); }} disabled={!fromDate && !toDate}>Clear dates</Button>
                                <Typography color="text.secondary">{filteredEvents.length} of {events.length} events in range</Typography>
                            </Stack>
                        </Paper>

                        <Box data-testid="report-summary-cards" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
                            <Paper variant="outlined" sx={{ p: 2.5 }}><Typography variant="overline">Members in scope</Typography><Typography variant="h4" sx={{ fontWeight: 800 }}>{members.length}</Typography><Typography color="text.secondary">{activeMembers} active</Typography></Paper>
                            <Paper variant="outlined" sx={{ p: 2.5 }}><Typography variant="overline">Events in range</Typography><Typography variant="h4" sx={{ fontWeight: 800 }}>{filteredEvents.length}</Typography><Typography color="text.secondary">{consentEvents} require consent</Typography></Paper>
                            <Paper variant="outlined" sx={{ p: 2.5 }}><Typography variant="overline">Section scope</Typography><Typography variant="h6" sx={{ fontWeight: 800 }}>{scopeLabel}</Typography><Typography color="text.secondary">Exports respect leader permissions</Typography></Paper>
                        </Box>

                        <Paper variant="outlined" sx={{ p: 2.5 }} data-testid="reporting-insights">
                            <Typography variant="h5" color="secondary" sx={{ fontWeight: 800, mb: 0.5 }}>Operational insights</Typography>
                            <Typography color="text.secondary" sx={{ mb: 2.5 }}>Calculated from the report snapshot already loaded for your permitted scope and selected date range.</Typography>
                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2 }}>
                                <Box>
                                    <Typography variant="overline">Recorded attendance rate</Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 800 }}>{insights.attendanceRate === null ? "—" : `${insights.attendanceRate}%`}</Typography>
                                    <Typography color="text.secondary">{insights.recordedResponses} recorded response{insights.recordedResponses === 1 ? "" : "s"}; missing responses are excluded</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="overline">Attendance recording</Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 800 }}>{insights.eventsWithAttendance}/{filteredEvents.length}</Typography>
                                    <Typography color="text.secondary">events have at least one recorded attendance response</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="overline">Consent received</Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 800 }}>{insights.consentReceived}</Typography>
                                    <Typography color="text.secondary">received records across {insights.consentRequiredEvents} consent-required event{insights.consentRequiredEvents === 1 ? "" : "s"}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="overline">Active membership</Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 800 }}>{insights.activeMembers}</Typography>
                                    <Typography color="text.secondary">{insights.inactiveMembers} inactive · {insights.leftMembers} left</Typography>
                                </Box>
                            </Box>
                            {insights.activeBySection.length > 0 && <Typography variant="body2" sx={{ mt: 2 }}><strong>Active by section:</strong> {insights.activeBySection.map((entry) => `${entry.section} ${entry.count}`).join(" · ")}</Typography>}
                            {insights.eventsWithoutAttendance > 0 && <Alert severity="warning" sx={{ mt: 2 }}>{insights.eventsWithoutAttendance} event{insights.eventsWithoutAttendance === 1 ? " has" : "s have"} no recorded attendance response in this range.</Alert>}
                            {insights.consentEventsWithoutReceived > 0 && <Alert severity="warning" sx={{ mt: 1.5 }}>{insights.consentEventsWithoutReceived} consent-required event{insights.consentEventsWithoutReceived === 1 ? " has" : "s have"} no consent marked received yet.</Alert>}
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 2.5 }} data-testid="printable-report-summary">
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                                <Box>
                                    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Printable operational summary</Typography>
                                    <Typography color="text.secondary">{scopeLabel} · {dateRangeLabel} · {members.length} members · {filteredEvents.length} events</Typography>
                                </Box>
                                <Button variant="outlined" color="secondary" onClick={() => void printSummary()}>Print Summary</Button>
                            </Stack>
                        </Paper>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" }, gap: 3 }}>
                            <Paper variant="outlined" sx={{ p: 3 }} data-testid="membership-summary-report">
                                <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Membership summary</Typography>
                                <Typography color="text.secondary" sx={{ mt: 1 }}>Section totals split into active, inactive and left members, plus an overall total.</Typography>
                                <Button variant="contained" color="success" sx={{ mt: 2.5 }} disabled={members.length === 0} onClick={() => void exportMembershipSummary()}>Export Membership Summary</Button>
                            </Paper>

                            <Paper variant="outlined" sx={{ p: 3 }} data-testid="member-list-report">
                                <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Member list</Typography>
                                <Typography color="text.secondary" sx={{ mt: 1 }}>{members.length} member record{members.length === 1 ? "" : "s"} available in your scope.</Typography>
                                <Typography variant="body2" sx={{ mt: 1.5 }}>Includes member name, section, status, parent/guardian name, email and mobile number.</Typography>
                                <Button variant="contained" color="success" sx={{ mt: 2.5 }} disabled={members.length === 0} onClick={() => void exportMembers()}>Export Member CSV</Button>
                            </Paper>

                            <Paper variant="outlined" sx={{ p: 3 }} data-testid="event-overview-report">
                                <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Event overview</Typography>
                                <Typography color="text.secondary" sx={{ mt: 1 }}>One row per event in the selected date range with status, consent requirement and recorded attendance/consent totals.</Typography>
                                <Button variant="contained" color="success" sx={{ mt: 2.5 }} disabled={filteredEvents.length === 0} onClick={() => void exportEventOverview()}>Export Event Overview</Button>
                            </Paper>

                            <Paper variant="outlined" sx={{ p: 3 }} data-testid="attendance-trends-report">
                                <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Attendance trends</Typography>
                                <Typography color="text.secondary" sx={{ mt: 1 }}>Event-by-event recorded responses, attending/not-attending totals and attendance rate for the selected date range.</Typography>
                                <Button variant="contained" color="success" sx={{ mt: 2.5 }} disabled={filteredEvents.length === 0} onClick={() => void exportAttendanceTrends()}>Export Attendance Trends</Button>
                            </Paper>

                            <Paper variant="outlined" sx={{ p: 3 }} data-testid="event-detail-report">
                                <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Event attendance & consent</Typography>
                                <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>Select an event in the current date range for a full operational roster or a focused outstanding-consent list.</Typography>
                                <Stack spacing={2}>
                                    <FormControl fullWidth><InputLabel>Event</InputLabel><Select label="Event" value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>{filteredEvents.map((event) => <MenuItem key={event.id} value={event.id}>{event.startDate || "No date"} — {event.title} ({event.section})</MenuItem>)}</Select></FormControl>
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                        <Button variant="contained" color="success" disabled={!selectedEvent || exportingEvent} onClick={() => void withSelectedEventMembers("roster")}>{exportingEvent ? "Preparing Export…" : "Export Event CSV"}</Button>
                                        <Button variant="outlined" color="secondary" disabled={!selectedEvent || exportingEvent || !selectedEvent.consentRequired} onClick={() => void withSelectedEventMembers("consent")}>Export Outstanding Consent</Button>
                                    </Stack>
                                </Stack>
                            </Paper>
                        </Box>
                    </Stack>
                )}
            </Container>
        </Box>
    );
}
