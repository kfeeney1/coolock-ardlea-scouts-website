import { useExperienceVersion } from "../hooks/useAttendanceExperience";
import EventRosterExportLink from "../components/admin/EventRosterExportLink";
import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { isCanonicalEventVisibilityAdmin } from "../services/eventVisibility.ts";

import EventHallUse from "../components/hall/EventHallUse";
import EventGalleryDialog from "../components/admin/EventGalleryDialog";
import EventRosterDialog from "../components/admin/EventRosterDialog";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import ProgrammeEquipmentDialog from "../components/admin/ProgrammeEquipmentDialog";
import { badgeworkSourceHref } from "../services/adventureSkillSourceContext";
import { loadEquipmentItems } from "../services/equipment";
import type { EquipmentItem } from "../services/equipment";
import { loadEquipmentLoans } from "../services/equipmentLoans";
import type { EquipmentLoan } from "../services/equipmentLoans";
import { loadEvents, setEventHidden, updateEventRoster } from "../services/eventAdmin";
import type { AttendanceStatus, EventConsentStatus, EventRecord } from "../services/eventAdmin";
import { eventAudienceSummary, eventCounts, eventMembers, eventStatusLabel } from "../services/eventManagementLogic";
import { loadMembers } from "../services/memberAdmin";
import { formatSiteDate } from "../services/siteDateFormat";
import type { MemberRecord } from "../services/memberAdmin";
import { trySecondaryRefresh } from "../services/secondaryRefresh";
import { loadLeaderAttendance, loadLeaderAttendanceOptions, saveLeaderAttendance } from "../services/leaderAttendance";
import type { LeaderAttendanceEntry } from "../services/leaderAttendance";
import type { WeeklyLeaderOption } from "../services/weeklyLeaderOptions";
import { mergeLeaderAttendanceRoster } from "../services/weeklyTrackerLogic";

function statusColor(status: EventRecord["status"]): "default" | "success" | "warning" | "secondary" {
    if (status === "open") return "success";
    if (status === "closed") return "warning";
    if (status === "completed") return "secondary";
    return "default";
}

export default function EventRecordPage() {
    const { eventId = "" } = useParams();
    const redesigned = useExperienceVersion("eventRecordExperience") === "redesigned";
    const [hallDraftDirty, setHallDraftDirty] = useState(false);
    const [event, setEvent] = useState<EventRecord | null>(null);
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
    const [equipmentLoans, setEquipmentLoans] = useState<EquipmentLoan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [rosterOpen, setRosterOpen] = useState(false);
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
    const [consent, setConsent] = useState<Record<string, EventConsentStatus>>({});
    const [leaderOptions, setLeaderOptions] = useState<WeeklyLeaderOption[]>([]);
    const [leaderAttendance, setLeaderAttendance] = useState<LeaderAttendanceEntry[]>([]);
    const [leaderAttendanceLoading, setLeaderAttendanceLoading] = useState(false);
    const [savingRoster, setSavingRoster] = useState(false);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [canManageVisibility, setCanManageVisibility] = useState(false);
    const [visibilityConfirmOpen, setVisibilityConfirmOpen] = useState(false);
    const [savingVisibility, setSavingVisibility] = useState(false);
    const [equipmentOpen, setEquipmentOpen] = useState(false);
    const loadRequestRef = useRef(0);

    const load = async (reportFailure = false) => {
        const requestId = ++loadRequestRef.current;
        setLoading(true);
        setError("");
        try {
            const loadedEvents = eventId ? await loadEvents(eventId) : [];
            const requested = loadedEvents.find((item) => item.id === eventId) ?? null;
            if (requestId !== loadRequestRef.current) return;
            setEvent(requested);
            setMembers([]);
            setEquipmentItems([]);
            setEquipmentLoans([]);
            setLeaderOptions([]);
            if (!requested) setError("This event could not be found or is outside your permitted sections.");
            setLoading(false);
            if (!requested) return;

            // Event details and Edit Event navigation do not depend on these
            // supporting datasets. Keep slower attendance/equipment reads from
            // leaving the whole record page on its loading screen.
            const supportingResults = await Promise.allSettled([
                loadMembers().then((value) => { if (requestId === loadRequestRef.current) setMembers(value); }),
                loadEquipmentItems().then((value) => { if (requestId === loadRequestRef.current) setEquipmentItems(value); }),
                loadEquipmentLoans().then((value) => { if (requestId === loadRequestRef.current) setEquipmentLoans(value); })
            ]);
            if (requestId !== loadRequestRef.current) return;

            const failedSupportingRead = supportingResults.find((result) => result.status === "rejected");
            if (failedSupportingRead?.status === "rejected") {
                setError(applicationErrorMessage(failedSupportingRead.reason, "Some event supporting details could not be loaded.", "EventRecordPage"));
                if (reportFailure) throw failedSupportingRead.reason;
            }
        } catch (loadError) {
            if (requestId !== loadRequestRef.current) return;
            setError(applicationErrorMessage(loadError, "Unable to load this event record.", "EventRecordPage"));
            if (reportFailure) throw loadError;
        } finally {
            if (requestId === loadRequestRef.current) setLoading(false);
        }
    };

    useEffect(() => { void load(); }, [eventId]);
    useEffect(() => {
        if (!eventId) return;
        let first = true;
        return onSnapshot(doc(db, "events", eventId), {includeMetadataChanges: true}, snapshot => {
            if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
            if (first) {first = false; return;}
            if (!snapshot.exists()) {
                ++loadRequestRef.current;
                setEvent(null);
                setLoading(false);
                setError("This event is no longer available.");
            } else void load();
        }, () => {
            ++loadRequestRef.current;
            setEvent(null);
            setLoading(false);
            setRosterOpen(false);
            setGalleryOpen(false);
            setEquipmentOpen(false);
            setError("This event is no longer available.");
        });
    }, [eventId]);
    useEffect(() => {
        let active = true;
        setCanManageVisibility(false);
        const user = auth.currentUser;
        if (user) void getDoc(doc(db, "adminUsers", user.uid)).then((snapshot) => {
            if (active) setCanManageVisibility(snapshot.exists() && isCanonicalEventVisibilityAdmin(snapshot.data()));
        }).catch(() => { if (active) setCanManageVisibility(false); });
        return () => { active = false; };
    }, [eventId]);

    const changeVisibility = async () => {
        if (!event || !canManageVisibility || savingVisibility) return;
        setSavingVisibility(true);
        setError("");
        try {
            await setEventHidden(event.id, !event.hidden);
            setVisibilityConfirmOpen(false);
            await load();
            setMessage(event.hidden ? "Event restored to normal visibility." : "Event hidden from parents and ordinary leaders.");
        } catch (changeError) {
            setError(applicationErrorMessage(changeError, "Unable to change event visibility.", "EventRecordPage"));
        } finally {
            setSavingVisibility(false);
        }
    };

    const rosterMembers = useMemo(() => event ? eventMembers(event, members) : [], [event, members]);
    const summary = event ? eventCounts(event, members) : null;
    const attendingMemberIds = event ? Object.entries(event.attendance).filter(([, status]) => status === "attending").map(([memberId]) => memberId) : [];
    const badgeworkHref = event ? badgeworkSourceHref({
        sourceType: event.eventType.toLowerCase().includes("activity") ? "activity" : "event",
        sourceId: event.id,
        memberIds: attendingMemberIds,
        returnTo: `/leader/events/${encodeURIComponent(event.id)}`
    }) : "/leader/badgework";

    const openRoster = async () => {
        if (!event) return;
        const nextAttendance: Record<string, AttendanceStatus> = {};
        const nextConsent: Record<string, EventConsentStatus> = {};
        eventMembers(event, members).forEach((member) => {
            nextAttendance[member.id] = event.attendance[member.id] || "invited";
            nextConsent[member.id] = event.consent[member.id] || (event.consentRequired ? "required" : "not-required");
        });
        setAttendance(nextAttendance);
        setConsent(nextConsent);
        setRosterOpen(true);
        setLeaderAttendanceLoading(true);
        setMessage("");
        setError("");
        try {
            const [options, saved] = await Promise.all([
                loadLeaderAttendanceOptions(["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"], true),
                loadLeaderAttendance("events", event.id)
            ]);
            const sections = event.audience?.sectionIds?.length ? event.audience.sectionIds : [event.section];
            const groupWide = sections.includes("All Sections") || event.section === "All Sections";
            setLeaderOptions(options);
            setLeaderAttendance(mergeLeaderAttendanceRoster(options, sections, groupWide, saved));
        } catch (loadError) {
            setError(applicationErrorMessage(loadError, "Unable to load leader attendance.", "EventRecordPage"));
        } finally {
            setLeaderAttendanceLoading(false);
        }
    };

    const saveRoster = async () => {
        if (!event || event.status === "completed") return;
        setSavingRoster(true);
        setError("");
        try {
            await updateEventRoster(event.id, attendance, consent);
            await saveLeaderAttendance("events", event.id, leaderAttendance);
            setRosterOpen(false);
            const refreshed = await trySecondaryRefresh(() => load(true), "the event roster");
            setMessage(refreshed
                ? "Attendance and consent roster updated."
                : "Attendance and consent roster saved, but the screen could not refresh. Reload the page to see the saved roster.");
        } catch (saveError) {
            setError(applicationErrorMessage(saveError, "Unable to save the attendance and consent roster.", "EventRecordPage"));
        } finally {
            setSavingRoster(false);
        }
    };

    const backToEvents = <Button component={Link} to="/leader/events" variant="outlined" color="secondary" sx={{ minHeight: 44, width: { xs: "100%", sm: "auto" }, whiteSpace: "nowrap" }}>Back to Events</Button>;
    const visibilityAction = event && canManageVisibility && <Button color={event.hidden ? "success" : "warning"} variant="contained" sx={{ minHeight: 44, width: { xs: "100%", sm: "auto" } }} onClick={() => setVisibilityConfirmOpen(true)}>{event.hidden ? "Show Event" : "Hide Event"}</Button>;
    const attendanceAction = event && <Button variant="contained" color={event.status === "completed" ? "secondary" : "success"} onClick={openRoster}>{event.status === "completed" ? "View Attendance" : "Attendance"}</Button>;
    const consentAction = event?.consentRequired && <Button component={Link} to={`/leader/event-consent?eventId=${encodeURIComponent(event.id)}`} variant="contained" color="warning">Manage Consent</Button>;
    const editAction = event && <Button component={Link} to={`/leader/events/${encodeURIComponent(event.id)}/edit`} variant="outlined" color="secondary" disabled={event.status === "completed"}>Edit Event</Button>;
    const programmeActions = event && (
        <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography component="h2" variant={redesigned ? "h6" : "h5"} color="secondary" sx={{ mb: 2 }}>{redesigned ? "Programme and resources" : "Event actions"}</Typography>
            <Box component="fieldset" disabled={hallDraftDirty} sx={{border: 0, p: 0, m: 0, minWidth: 0, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: redesigned ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))" }, gap: 1.25 }}>
                {!event.hidden && <EventRosterExportLink eventId={event.id} />}
                {!redesigned && attendanceAction}
                {!redesigned && consentAction}
                <Button component={Link} to={badgeworkHref} variant="contained" color="success" disabled={attendingMemberIds.length === 0}>Record Badgework</Button>
                <Button variant="outlined" color="success" onClick={() => setGalleryOpen(true)}>Gallery</Button>
                <Button variant="outlined" color="primary" onClick={() => setEquipmentOpen(true)}>Equipment</Button>
                {!redesigned && editAction}
            </Box>
        </Paper>
    );

    return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
        <Container maxWidth="xl">
            <LeaderDashboardHeader />
            {loading ? <Box sx={{ minHeight: 320, display: "grid", placeItems: "center" }}><CircularProgress color="success" /></Box> : !event ? <>
                <LeaderPageHeader title="Event Record" description="Event details and actions." />
                <Alert severity="error" sx={{ mb: 3 }}>{error || "Event not found."}</Alert>
                <Button component={Link} to="/leader/events" variant="outlined" color="secondary" sx={{ minHeight: 44 }}>Back to Events &amp; Activities</Button>
            </> : <>
                {redesigned ? (
                    <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} alignItems={{ sm: "start" }} justifyContent="space-between" sx={{ mb: 2 }}>
                        <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                            <Typography component="h1" variant="h4" color="secondary">{event.title}</Typography>
                            <Typography color="text.secondary">{event.section} · {event.eventType} · {eventStatusLabel(event.status)}</Typography>
                        </Box>
                        {backToEvents}
                    </Stack>
                ) : <LeaderPageHeader title={event.title} actions={backToEvents} />}
                {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                {event.hidden && <Alert severity="warning" sx={{ mb: 2 }} data-testid="event-hidden-banner">Hidden event — only Super Admin can view this record.</Alert>}
                {!redesigned && visibilityAction && <Box sx={{ mb: 2 }}>{visibilityAction}</Box>}
                <Dialog open={visibilityConfirmOpen && canManageVisibility} onClose={() => { if (!savingVisibility) setVisibilityConfirmOpen(false); }} fullWidth maxWidth="xs">
                    <DialogTitle>{event.hidden ? "Show Event" : "Hide Event"}</DialogTitle>
                    <DialogContent><Typography>{event.hidden ? "Restore this event to normal visibility?" : "Hide this event from parents and ordinary leaders? All existing event records will be retained."}</Typography><Typography sx={{ mt: 1, fontWeight: 700 }}>{event.title} · {event.section} · {formatSiteDate(event.startDate)}</Typography></DialogContent>
                    <DialogActions><Button disabled={savingVisibility} onClick={() => setVisibilityConfirmOpen(false)}>Cancel</Button><Button disabled={savingVisibility} variant="contained" color={event.hidden ? "success" : "warning"} onClick={() => void changeVisibility()}>{savingVisibility ? "Saving…" : event.hidden ? "Show Event" : "Hide Event"}</Button></DialogActions>
                </Dialog>
                {event.status === "completed" && <Alert severity="info" sx={{ mb: 3 }}>Completed event history is read-only. Attendance, reports, exports and gallery access remain available.</Alert>}

                <Paper variant="outlined" sx={{ p: redesigned ? 0 : { xs: 2.5, md: 3 }, mb: 3, ...(redesigned && { border: 0, bgcolor: "transparent" }) }} data-testid={`event-record-${event.id}`}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2, ...(redesigned && { "& .MuiChip-root": { maxWidth: "100%", height: "auto" }, "& .MuiChip-label": { whiteSpace: "normal", overflowWrap: "anywhere", py: 0.5 } }) }}>
                        <Chip label={eventStatusLabel(event.status)} color={statusColor(event.status)} />
                        <Chip label={event.section} variant="outlined" />
                        {event.audience && <Chip data-testid="event-record-audience" label={eventAudienceSummary(event.audience.sectionIds, event.audience.memberIds, event.audience.resolvedMemberIds.length)} variant="outlined" />}
                        <Chip label={event.eventType} variant="outlined" />
                        {event.consentRequired && <Chip label="Consent required" color="warning" variant="outlined" />}
                    </Stack>
                    {redesigned && (
                        <Box component="fieldset" disabled={hallDraftDirty} sx={{ border: 0, p: 0, m: 0, minWidth: 0, display: "grid", gap: 1.25, mb: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, max-content)" } }}>
                            {attendanceAction}
                            {editAction}
                            {consentAction}
                        </Box>
                    )}
                    <Box sx={{ display: redesigned ? "grid" : "contents", gridTemplateColumns: {xs: "1fr", md: "minmax(0, 3fr) minmax(0, 2fr)"}, gap: 2, alignItems: "start" }}>
                        <Box sx={{ display: redesigned ? "block" : "contents", p: redesigned ? 2 : 0, border: redesigned ? 1 : 0, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", overflowWrap: "anywhere" }}>
                            {redesigned && <Typography component="h2" variant="h6" color="secondary" sx={{ mb: 1 }}>Event details</Typography>}
                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
                                <Box><Typography variant="overline" color="text.secondary">Dates</Typography><Typography>{formatSiteDate(event.startDate)}{event.endDate && event.endDate !== event.startDate ? ` to ${formatSiteDate(event.endDate)}` : ""}</Typography></Box>
                                <Box><Typography variant="overline" color="text.secondary">Location</Typography><Typography>{event.location || "Not set"}</Typography></Box>
                                <Box><Typography variant="overline" color="text.secondary">Meeting point</Typography><Typography>{event.meetingPoint || "Not set"}</Typography></Box>
                                <Box><Typography variant="overline" color="text.secondary">Return details</Typography><Typography>{event.returnDetails || "Not set"}</Typography></Box>
                            </Box>
                            {event.description && <Box sx={{ mt: 2.5 }}><Typography variant="overline" color="text.secondary">Description</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{event.description}</Typography></Box>}
                            {event.leaderNotes && <Box sx={{ mt: 2.5 }}><Typography variant="overline" color="text.secondary">Leader notes</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{event.leaderNotes}</Typography></Box>}
                        </Box>
                        <Stack gap={2} sx={{ display: redesigned ? "flex" : "contents", minWidth: 0 }}>
                            <Box sx={{ display: redesigned ? "block" : "contents", p: redesigned ? 2 : 0, border: redesigned ? 1 : 0, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
                                {redesigned && <Typography component="h2" variant="h6" color="secondary">Attendance and consent</Typography>}
                                {summary && <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: redesigned ? 1 : 2.5 }}>
                                    <Chip label={`${summary.attending} attending`} color="success" variant="outlined" />
                                    <Chip label={`${summary.notAttending} not attending`} variant="outlined" />
                                    <Chip label={`${summary.invited} invited`} variant="outlined" />
                                    {event.consentRequired && <Chip label={`${summary.consentReceived} consent received`} color="success" variant="outlined" />}
                                    {event.consentRequired && summary.consentOutstanding > 0 && <Chip label={`${summary.consentOutstanding} consent outstanding`} color="error" />}
                                </Stack>}
                            </Box>
                            {redesigned && programmeActions}
                        </Stack>
                    </Box>
                </Paper>

                {!redesigned && programmeActions}
                {redesigned && visibilityAction && (
                    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                        <Typography component="h2" variant="h6" color="secondary" sx={{ mb: 1 }}>Event visibility</Typography>
                        {visibilityAction}
                    </Paper>
                )}

                {event.status === "completed" && <Box sx={{mt: 3}}><EventHallUse key={`${event.id}:${event.hallRevision ?? 0}`} event={event} allowNew={false} blocked={rosterOpen || galleryOpen || equipmentOpen || savingRoster} onDirty={setHallDraftDirty} onSaved={() => void load()} /></Box>}
                <EventRosterDialog event={rosterOpen ? event : null} members={rosterMembers} attendance={attendance} consent={consent} leaderOptions={leaderOptions} leaderAttendance={leaderAttendance} leaderAttendanceLoading={leaderAttendanceLoading} onLeaderAttendanceChange={setLeaderAttendance} saving={savingRoster} onAttendanceChange={setAttendance} onConsentChange={setConsent} onClose={() => setRosterOpen(false)} onSave={() => void saveRoster()} />
                <EventGalleryDialog event={galleryOpen ? event : null} onClose={() => setGalleryOpen(false)} />
                {equipmentOpen && <ProgrammeEquipmentDialog open sourceType={event.eventType.toLowerCase().includes("activity") ? "activity" : "event"} sourceId={event.id} sourceLabel={event.title} section={event.section} date={event.startDate} items={equipmentItems} loans={equipmentLoans} readOnly={event.status === "completed"} onClose={() => setEquipmentOpen(false)} onChanged={load} />}
            </>}
        </Container>
    </Box>;
}
