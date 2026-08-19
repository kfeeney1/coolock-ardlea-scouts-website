import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Paper,
    Stack,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { loadEvents, updateEventRoster } from "../services/eventAdmin";
import type { AttendanceStatus, EventConsentStatus, EventRecord } from "../services/eventAdmin";
import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";
import {
    ensurePublicEventLink,
    loadEventConsentLinks,
    loadEventConsentResponses
} from "../services/eventConsent";
import type {
    EventConsentResponse,
    PublicEventLink
} from "../services/eventConsent";

function normalise(value: string): string {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function formatDate(value: Date | null): string {
    if (!value) return "Unknown";
    return new Intl.DateTimeFormat("en-IE", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(value);
}

export default function EventConsentManagement() {
    const [events, setEvents] = useState<EventRecord[]>([]);
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [links, setLinks] = useState<PublicEventLink[]>([]);
    const [responses, setResponses] = useState<Record<string, EventConsentResponse[]>>({});
    const [loading, setLoading] = useState(true);
    const [workingEventId, setWorkingEventId] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const load = async () => {
        setLoading(true);
        setError("");

        try {
            const [loadedEvents, loadedMembers, loadedLinks] = await Promise.all([
                loadEvents(),
                loadMembers(),
                loadEventConsentLinks()
            ]);

            setEvents(loadedEvents);
            setMembers(loadedMembers);
            setLinks(loadedLinks);

            const responseEntries = await Promise.all(
                loadedEvents.map(async (event) => [
                    event.id,
                    await loadEventConsentResponses(event.id)
                ] as const)
            );

            setResponses(Object.fromEntries(responseEntries));
        } catch (loadError) {
            console.error("Unable to load parent event consent:", loadError);
            setError("Unable to load event consent information.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const consentEvents = useMemo(
        () => events.filter((event) => event.consentRequired),
        [events]
    );

    const linkFor = (eventId: string) =>
        links.find((link) => link.eventId === eventId) || null;

    const createOrRefreshLink = async (event: EventRecord) => {
        setWorkingEventId(event.id);
        setError("");
        setMessage("");

        try {
            const link = await ensurePublicEventLink(event);
            setLinks((current) => [
                link,
                ...current.filter((item) => item.eventId !== event.id)
            ]);
            setMessage(
                link.active
                    ? "Parent consent link is ready."
                    : "The link was created, but it will only be available while the event is Open and requires consent."
            );
        } catch (linkError) {
            console.error("Unable to create event consent link:", linkError);
            setError("Unable to create or refresh the parent consent link.");
        } finally {
            setWorkingEventId("");
        }
    };

    const copyLink = async (link: PublicEventLink) => {
        const url = `${window.location.origin}/event-consent/${link.token}`;

        try {
            await navigator.clipboard.writeText(url);
            setMessage("Parent consent link copied to clipboard.");
        } catch {
            window.prompt("Copy this parent consent link:", url);
        }
    };

    const syncResponses = async (event: EventRecord) => {
        setWorkingEventId(event.id);
        setError("");
        setMessage("");

        try {
            const eventResponses = responses[event.id] || [];
            const attendance: Record<string, AttendanceStatus> = {
                ...event.attendance
            };
            const consent: Record<string, EventConsentStatus> = {
                ...event.consent
            };

            let matched = 0;
            let unmatched = 0;
            const usedMembers = new Set<string>();

            for (const response of eventResponses) {
                const member = members.find(
                    (candidate) =>
                        !usedMembers.has(candidate.id) &&
                        normalise(candidate.displayName) === normalise(response.childName) &&
                        (!candidate.dateOfBirth || candidate.dateOfBirth === response.dateOfBirth)
                );

                if (!member) {
                    unmatched += 1;
                    continue;
                }

                usedMembers.add(member.id);
                matched += 1;
                attendance[member.id] = response.attendance;

                if (response.attendance === "not-attending") {
                    consent[member.id] = "not-required";
                } else if (response.consentGiven) {
                    consent[member.id] = "received";
                } else {
                    consent[member.id] = "required";
                }
            }

            await updateEventRoster(event.id, attendance, consent);
            await load();
            setMessage(
                `Synced ${matched} parent response${matched === 1 ? "" : "s"}.` +
                (unmatched > 0
                    ? ` ${unmatched} response${unmatched === 1 ? "" : "s"} could not be matched automatically.`
                    : "")
            );
        } catch (syncError) {
            console.error("Unable to sync event consent responses:", syncError);
            setError("Unable to sync parent responses into the event roster.");
        } finally {
            setWorkingEventId("");
        }
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <LeaderPageHeader
                    title="Parent Event Consent"
                    description="Create parent-facing event links, review responses and sync them into event attendance and consent."
                    actions={
                        <Button variant="outlined" color="secondary" onClick={() => void load()}>
                            Refresh
                        </Button>
                    }
                />

                {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                <Alert severity="info" sx={{ mb: 3 }}>
                    Parent links only expose public event details. Leader notes, member lists and existing consent records remain leader-only.
                </Alert>

                {loading ? (
                    <Box sx={{ minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <CircularProgress color="success" />
                    </Box>
                ) : (
                    <Box sx={{ display: "grid", gap: 2 }}>
                        {consentEvents.length === 0 && (
                            <Alert severity="info">
                                No events currently require consent. Enable “Consent required” on an event first.
                            </Alert>
                        )}

                        {consentEvents.map((event) => {
                            const link = linkFor(event.id);
                            const eventResponses = responses[event.id] || [];
                            const received = eventResponses.filter(
                                (response) =>
                                    response.attendance === "attending" &&
                                    response.consentGiven
                            ).length;
                            const notAttending = eventResponses.filter(
                                (response) => response.attendance === "not-attending"
                            ).length;
                            const changedDetails = eventResponses.filter(
                                (response) => response.medicalDetailsChanged
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
                                                <Typography variant="h5" color="secondary">
                                                    {event.title}
                                                </Typography>
                                                <Chip label={event.status} size="small" variant="outlined" />
                                                <Chip label={`${eventResponses.length} responses`} size="small" />
                                                <Chip label={`${received} consent received`} size="small" color="success" />
                                                {notAttending > 0 && <Chip label={`${notAttending} not attending`} size="small" />}
                                                {changedDetails > 0 && <Chip label={`${changedDetails} details changed`} size="small" color="warning" />}
                                            </Stack>

                                            <Typography sx={{ mt: 1 }}>
                                                {event.startDate}
                                                {event.location ? ` · ${event.location}` : ""}
                                            </Typography>

                                            {link && (
                                                <Typography color="text.secondary" sx={{ mt: 0.75, wordBreak: "break-all" }}>
                                                    {window.location.origin}/event-consent/{link.token}
                                                </Typography>
                                            )}

                                            {eventResponses.slice(0, 5).map((response) => (
                                                <Typography key={response.id} variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                    {response.childName} — {response.attendance === "attending" ? "Attending" : "Not attending"}
                                                    {response.consentGiven ? " · Consent received" : ""}
                                                    {response.medicalDetailsChanged ? " · Details changed" : ""}
                                                    {` · ${formatDate(response.submittedAt)}`}
                                                </Typography>
                                            ))}
                                        </Box>

                                        <Stack direction={{ xs: "column", sm: "row", lg: "column" }} spacing={1.25} sx={{ minWidth: { lg: 210 } }}>
                                            <Button
                                                variant={link?.active ? "outlined" : "contained"}
                                                color="secondary"
                                                disabled={workingEventId === event.id}
                                                onClick={() => void createOrRefreshLink(event)}
                                            >
                                                {link ? "Refresh Link" : "Create Parent Link"}
                                            </Button>

                                            {link && (
                                                <Button variant="outlined" color="secondary" onClick={() => void copyLink(link)}>
                                                    Copy Link
                                                </Button>
                                            )}

                                            <Button
                                                variant="contained"
                                                color="success"
                                                disabled={workingEventId === event.id || eventResponses.length === 0}
                                                onClick={() => void syncResponses(event)}
                                            >
                                                Sync Responses
                                            </Button>
                                        </Stack>
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Box>
                )}
            </Container>
        </Box>
    );
}
