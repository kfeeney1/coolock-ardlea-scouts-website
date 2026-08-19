import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Divider,
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

function findMatchingMember(
    response: EventConsentResponse,
    members: MemberRecord[],
    usedMembers?: Set<string>
): MemberRecord | undefined {
    return members.find(
        (candidate) =>
            !usedMembers?.has(candidate.id) &&
            normalise(candidate.displayName) === normalise(response.childName) &&
            (!candidate.dateOfBirth || candidate.dateOfBirth === response.dateOfBirth)
    );
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
                const member = findMatchingMember(response, members, usedMembers);

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
                    ? ` ${unmatched} response${unmatched === 1 ? "" : "s"} could not be matched automatically. See Unmatched Parent Responses below.`
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
                            const unmatchedResponses = eventResponses.filter(
                                (response) => !findMatchingMember(response, members)
                            );

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
                                        <Box sx={{ flex: 1 }}>
                                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                                                <Typography variant="h5" color="secondary">
                                                    {event.title}
                                                </Typography>
                                                <Chip label={event.status} size="small" variant="outlined" />
                                                <Chip label={`${eventResponses.length} responses`} size="small" />
                                                <Chip label={`${received} consent received`} size="small" color="success" />
                                                {notAttending > 0 && <Chip label={`${notAttending} not attending`} size="small" />}
                                                {changedDetails > 0 && <Chip label={`${changedDetails} details changed`} size="small" color="warning" />}
                                                {unmatchedResponses.length > 0 && (
                                                    <Chip
                                                        label={`${unmatchedResponses.length} unmatched`}
                                                        size="small"
                                                        color="error"
                                                    />
                                                )}
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

                                            {unmatchedResponses.length > 0 && (
                                                <Box sx={{ mt: 2.5 }}>
                                                    <Divider sx={{ mb: 2 }} />
                                                    <Typography variant="h6" color="error" sx={{ fontWeight: 800, mb: 0.5 }}>
                                                        Unmatched Parent Responses
                                                    </Typography>
                                                    <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                                                        These responses could not be matched to a member by child name and date of birth and need manual review.
                                                    </Typography>

                                                    <Box sx={{ display: "grid", gap: 1.5 }}>
                                                        {unmatchedResponses.map((response) => (
                                                            <Paper
                                                                key={response.id}
                                                                variant="outlined"
                                                                sx={{
                                                                    p: 2,
                                                                    borderLeft: "5px solid",
                                                                    borderLeftColor: "error.main"
                                                                }}
                                                            >
                                                                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
                                                                    <Chip label="Needs manual matching" color="error" size="small" />
                                                                    <Chip
                                                                        label={response.attendance === "attending" ? "Attending" : "Not attending"}
                                                                        size="small"
                                                                        variant="outlined"
                                                                    />
                                                                    <Chip
                                                                        label={response.consentGiven ? "Consent given" : "Consent not given"}
                                                                        size="small"
                                                                        color={response.consentGiven ? "success" : "warning"}
                                                                    />
                                                                </Stack>

                                                                <Typography sx={{ fontWeight: 700 }}>
                                                                    Child: {response.childName || "Not supplied"}
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    Date of birth: {response.dateOfBirth || "Not supplied"}
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    Parent / Guardian: {response.parentName || "Not supplied"}
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    Emergency details confirmed: {response.emergencyDetailsConfirmed ? "Yes" : "No"}
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    Medical / emergency information changed: {response.medicalDetailsChanged ? "Yes" : "No"}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                                    Submitted: {formatDate(response.submittedAt)}
                                                                </Typography>
                                                            </Paper>
                                                        ))}
                                                    </Box>
                                                </Box>
                                            )}
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
