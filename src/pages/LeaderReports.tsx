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
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { recordAuditEvent } from "../services/auditLog";
import {
    loadEventReportMembers,
    loadEventReportRecords,
    loadMemberReportRows
} from "../services/reporting";
import type { EventReportRecord, MemberReportRow } from "../services/reportingLogic";
import { eventRosterCsv, memberReportCsv, slug } from "../services/reportingLogic";

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
                const [memberRows, eventRows] = await Promise.all([
                    loadMemberReportRows(scope),
                    loadEventReportRecords(scope)
                ]);
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

    const selectedEvent = events.find((event) => event.id === selectedEventId) || null;
    const scopeLabel = isAdmin
        ? "All sections"
        : sections.length > 0
          ? sections.join(", ")
          : "No sections assigned";

    const exportMembers = async () => {
        if (members.length === 0) return;
        downloadCsv(`member-report-${new Date().toISOString().slice(0, 10)}.csv`, memberReportCsv(members));
        await recordAuditEvent({
            category: "member",
            action: "Member report exported",
            targetId: "member-report",
            targetLabel: "Member report",
            description: `Exported ${members.length} member rows. Export excludes date of birth, medical and emergency-contact fields.`,
            section: scopeLabel
        });
    };

    const exportEvent = async () => {
        if (!selectedEvent) return;
        setExportingEvent(true);
        setError("");
        try {
            const eventMembers = await loadEventReportMembers(selectedEvent, scope);
            downloadCsv(`${slug(selectedEvent.title)}-attendance-consent.csv`, eventRosterCsv(selectedEvent, eventMembers));
            await recordAuditEvent({
                category: "event",
                action: "Event report exported",
                targetId: selectedEvent.id,
                targetLabel: selectedEvent.title,
                description: `Exported attendance and consent status for ${eventMembers.length} active members. Export excludes contact, emergency and medical fields.`,
                section: selectedEvent.section
            });
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
                <LeaderPageHeader
                    title="Reports & Exports"
                    description="Download operational CSV reports limited to the records your leader account is permitted to access."
                />

                <Alert severity="info" sx={{ mb: 3 }}>
                    Report scope: <strong>{scopeLabel}</strong>. Default exports deliberately exclude medical details, date of birth and emergency-contact information.
                </Alert>

                {!isAdmin && sections.length === 0 && (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        Your leader account has no sections assigned, so no report data can be loaded.
                    </Alert>
                )}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                {loading ? (
                    <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}>
                        <CircularProgress color="success" />
                    </Box>
                ) : (
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3 }}>
                        <Paper variant="outlined" sx={{ p: 3 }}>
                            <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Member list</Typography>
                            <Typography color="text.secondary" sx={{ mt: 1 }}>
                                {members.length} member record{members.length === 1 ? "" : "s"} available in your scope.
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1.5 }}>
                                Includes member name, section, status, parent/guardian name, email and mobile number.
                            </Typography>
                            <Button
                                variant="contained"
                                color="success"
                                sx={{ mt: 2.5 }}
                                disabled={members.length === 0}
                                onClick={() => void exportMembers()}
                            >
                                Export Member CSV
                            </Button>
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 3 }}>
                            <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Event attendance & consent</Typography>
                            <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                                Select an event to export active-member attendance and consent status only.
                            </Typography>
                            <Stack spacing={2}>
                                <FormControl fullWidth>
                                    <InputLabel>Event</InputLabel>
                                    <Select
                                        label="Event"
                                        value={selectedEventId}
                                        onChange={(event) => setSelectedEventId(event.target.value)}
                                    >
                                        {events.map((event) => (
                                            <MenuItem key={event.id} value={event.id}>
                                                {event.startDate || "No date"} — {event.title} ({event.section})
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Button
                                    variant="contained"
                                    color="success"
                                    disabled={!selectedEvent || exportingEvent}
                                    onClick={() => void exportEvent()}
                                >
                                    {exportingEvent ? "Preparing Export…" : "Export Event CSV"}
                                </Button>
                            </Stack>
                        </Paper>
                    </Box>
                )}
            </Container>
        </Box>
    );
}
