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
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
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
    ignoreEventConsentResponse,
    loadEventConsentLinks,
    loadEventConsentResponses,
    markEventConsentResponseMatched
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

function applyResponseToRoster(
    response: EventConsentResponse,
    memberId: string,
    attendance: Record<string, AttendanceStatus>,
    consent: Record<string, EventConsentStatus>
) {
    attendance[memberId] = response.attendance;

    if (response.attendance === "not-attending") {
        consent[memberId] = "not-required";
    } else if (response.consentGiven) {
        consent[memberId] = "received";
    } else {
        consent[memberId] = "required";
    }
}

export default function EventConsentManagement() {
    const [events, setEvents] = useState<EventRecord[]>([]);
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [links, setLinks] = useState<PublicEventLink[]>([]);
    const [responses, setResponses] = useState<Record<string, EventConsentResponse[]>>({});
    const [selectedMembers, setSelectedMembers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [workingEventId, setWorkingEventId] = useState("");
    const [workingResponseId, setWorkingResponseId] = useState("");
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
            const eventResponses = (responses[event.id] || []).filter(
                (response) => response.processingStatus === "new"
            );
            const attendance: Record<string, AttendanceStatus> = {
                ...event.attendance
            };
            const consent: Record<string, EventConsentStatus> = {
                ...event.consent
            };

            let matched = 0;
            let unmatched = 0;
            const usedMembers = new Set<string>();
            const matchedResponses: Array<{ responseId: string; memberId: string }> = [];

            for (const response of eventResponses) {
                const member = findMatchingMember(response, members, usedMembers);

                if (!member) {
                    unmatched += 1;
                    continue;
                }

                usedMembers.add(member.id);
                matched += 1;
                applyResponseToRoster(response, member.id, attendance, consent);
                matchedResponses.push({ responseId: response.id, memberId: member.id });
            }

            if (matchedResponses.length > 0) {
                await updateEventRoster(event.id, attendance, consent);
                await Promise.all(
                    matchedResponses.map((item) =>
                        markEventConsentResponseMatched(item.responseId, item.memberId)
                    )
                );
            }

            await load();
            setMessage(
                `Synced ${matched} parent response${matched === 1 ? "" : "s"}.` +
                (unmatched > 0
                    ? ` ${unmatched} response${unmatched === 1 ? "" : "s"} could not be matched automatically. Use Manual Match below.`
                    : "")
            );
        } catch (syncError) {
            console.error("Unable to sync event consent responses:", syncError);
            setError("Unable to sync parent responses into the event roster.");
        } finally {
            setWorkingEventId("");
        }
    };

    const manualMatch = async (
        event: EventRecord,
        response: EventConsentResponse
    ) => {
        const memberId = selectedMembers[response.id];

        if (!memberId) {
            setError("Select a member before matching the response.");
            return;
        }

        setWorkingResponseId(response.id);
        setError("");
        setMessage("");

        try {
            const attendance = { ...event.attendance };
            const consent = { ...event.consent };
            applyResponseToRoster(response, memberId, attendance, consent);

            await updateEventRoster(event.id, attendance, consent);
            await markEventConsentResponseMatched(response.id, memberId);
            await load();

            const member = members.find((candidate) => candidate.id === memberId);
            setMessage(
                `Response for ${response.childName} matched to ${member?.displayName || "the selected member"}.`
            );
        } catch (matchError) {
            console.error("Unable to manually match response:", matchError);
            setError("Unable to match the parent response to the selected member.");
        } finally {
            setWorkingResponseId("");
        }
    };

    const ignoreResponse = async (response: EventConsentResponse) => {
        setWorkingResponseId(response.id);
        setError("");
        setMessage("");

        try {
            await ignoreEventConsentResponse(response.id);
            await load();
            setMessage(`Response for ${response.childName} marked as ignored.`);
        } catch (ignoreError) {
            console.error("Unable to ignore response:", ignoreError);
            setError("Unable to mark the parent response as ignored.");
        } finally {
            setWorkingResponseId("");
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
                            const newResponses = eventResponses.filter(
                                (response) => response.processingStatus === "new"
                            );
                            const matchedResponses = eventResponses.filter(
                                (response) => response.processingStatus === "matched"
                            );
                            const ignoredResponses = eventResponses.filter(
                                (response) => response.processingStatus === "ignored"
                            );
                            const unmatchedResponses = newResponses.filter(
                                (response) => !findMatchingMember(response, members)
                            );
                            const received = eventResponses.filter(
                                (response) =>
                                    response.attendance === "attending" &&
                                    response.consentGiven
                            ).length;
                            const changedDetails = eventResponses.filter(
                                (response) => response.medicalDetailsChanged
                            ).length;
                            const eligibleMembers = members.filter(
                                (member) =>
                                    member.status === "active" &&
                                    (event.section === "All Sections" || member.section === event.section)
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
                                                <Chip label={`${newResponses.length} new`} size="small" color={newResponses.length ? "warning" : "default"} />
                                                <Chip label={`${matchedResponses.length} matched`} size="small" color="success" />
                                                <Chip label={`${ignoredResponses.length} ignored`} size="small" variant="outlined" />
                                                <Chip label={`${received} consent received`} size="small" color="success" />
                                                {changedDetails > 0 && <Chip label={`${changedDetails} details changed`} size="small" color="warning" />}
                                                {unmatchedResponses.length > 0 && (
                                                    <Chip label={`${unmatchedResponses.length} unmatched`} size="small" color="error" />
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

                                            {unmatchedResponses.length > 0 && (
                                                <Box sx={{ mt: 2.5 }}>
                                                    <Divider sx={{ mb: 2 }} />
                                                    <Typography variant="h6" color="error" sx={{ fontWeight: 800, mb: 0.5 }}>
                                                        Unmatched Parent Responses
                                                    </Typography>
                                                    <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                                                        Select the correct member and manually match the response, or ignore duplicate/test submissions.
                                                    </Typography>

                                                    <Box sx={{ display: "grid", gap: 1.5 }}>
                                                        {unmatchedResponses.map((response) => (
                                                            <Paper
                                                                key={response.id}
                                                                variant="outlined"
                                                                sx={{ p: 2, borderLeft: "5px solid", borderLeftColor: "error.main" }}
                                                            >
                                                                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
                                                                    <Chip label="Needs manual matching" color="error" size="small" />
                                                                    <Chip label={response.attendance === "attending" ? "Attending" : "Not attending"} size="small" variant="outlined" />
                                                                    <Chip label={response.consentGiven ? "Consent given" : "Consent not given"} size="small" color={response.consentGiven ? "success" : "warning"} />
                                                                </Stack>

                                                                <Typography sx={{ fontWeight: 700 }}>
                                                                    Child: {response.childName || "Not supplied"}
                                                                </Typography>
                                                                <Typography variant="body2">Date of birth: {response.dateOfBirth || "Not supplied"}</Typography>
                                                                <Typography variant="body2">Parent / Guardian: {response.parentName || "Not supplied"}</Typography>
                                                                <Typography variant="body2">Emergency details confirmed: {response.emergencyDetailsConfirmed ? "Yes" : "No"}</Typography>
                                                                <Typography variant="body2">Medical / emergency information changed: {response.medicalDetailsChanged ? "Yes" : "No"}</Typography>
                                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                                    Submitted: {formatDate(response.submittedAt)}
                                                                </Typography>

                                                                <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} sx={{ mt: 2, alignItems: { md: "center" } }}>
                                                                    <FormControl size="small" sx={{ minWidth: 280, flex: 1 }}>
                                                                        <InputLabel>Match to member</InputLabel>
                                                                        <Select
                                                                            label="Match to member"
                                                                            value={selectedMembers[response.id] || ""}
                                                                            onChange={(eventChange) =>
                                                                                setSelectedMembers((current) => ({
                                                                                    ...current,
                                                                                    [response.id]: eventChange.target.value
                                                                                }))
                                                                            }
                                                                        >
                                                                            {eligibleMembers.map((member) => (
                                                                                <MenuItem key={member.id} value={member.id}>
                                                                                    {member.displayName} · {member.section} · {member.dateOfBirth || "DOB not recorded"}
                                                                                </MenuItem>
                                                                            ))}
                                                                        </Select>
                                                                    </FormControl>
                                                                    <Button
                                                                        variant="contained"
                                                                        color="success"
                                                                        disabled={workingResponseId === response.id || !selectedMembers[response.id]}
                                                                        onClick={() => void manualMatch(event, response)}
                                                                    >
                                                                        Match to Member
                                                                    </Button>
                                                                    <Button
                                                                        variant="outlined"
                                                                        color="error"
                                                                        disabled={workingResponseId === response.id}
                                                                        onClick={() => void ignoreResponse(response)}
                                                                    >
                                                                        Ignore Response
                                                                    </Button>
                                                                </Stack>
                                                            </Paper>
                                                        ))}
                                                    </Box>
                                                </Box>
                                            )}

                                            {(matchedResponses.length > 0 || ignoredResponses.length > 0) && (
                                                <Box sx={{ mt: 2.5 }}>
                                                    <Divider sx={{ mb: 2 }} />
                                                    <Typography variant="h6" color="secondary" sx={{ fontWeight: 800, mb: 1 }}>
                                                        Processed Responses
                                                    </Typography>
                                                    <Box sx={{ display: "grid", gap: 1 }}>
                                                        {[...matchedResponses, ...ignoredResponses].map((response) => {
                                                            const matchedMember = members.find((member) => member.id === response.matchedMemberId);
                                                            return (
                                                                <Paper key={response.id} variant="outlined" sx={{ p: 1.5 }}>
                                                                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                                                                        <Chip
                                                                            label={response.processingStatus === "matched" ? "Matched" : "Ignored"}
                                                                            color={response.processingStatus === "matched" ? "success" : "default"}
                                                                            size="small"
                                                                        />
                                                                        <Typography sx={{ fontWeight: 700 }}>{response.childName}</Typography>
                                                                        {matchedMember && (
                                                                            <Typography variant="body2" color="text.secondary">
                                                                                → {matchedMember.displayName}
                                                                            </Typography>
                                                                        )}
                                                                        <Typography variant="body2" color="text.secondary">
                                                                            {formatDate(response.processedAt)}
                                                                        </Typography>
                                                                    </Stack>
                                                                </Paper>
                                                            );
                                                        })}
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
                                                disabled={workingEventId === event.id || newResponses.length === 0}
                                                onClick={() => void syncResponses(event)}
                                            >
                                                Sync New Responses
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
