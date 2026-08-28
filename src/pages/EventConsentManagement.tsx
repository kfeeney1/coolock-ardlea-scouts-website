import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import EventConsentEventPanel from "../components/admin/EventConsentEventPanel";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { loadEvents, updateEventRoster } from "../services/eventAdmin";
import type { AttendanceStatus, EventConsentStatus, EventRecord } from "../services/eventAdmin";
import {
    notifyEventConsentProcessed,
    notifyEventParents
} from "../services/emailNotifications";
import type { EventNotificationKind } from "../services/emailNotifications";
import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";
import {
    ensurePublicEventLink,
    ignoreEventConsentResponse,
    loadEventConsentLinks,
    loadEventConsentResponses,
    markEventConsentResponseMatched
} from "../services/eventConsent";
import type { EventConsentResponse, PublicEventLink } from "../services/eventConsent";
import {
    applyResponseToRoster,
    eligibleEventMembers,
    findMatchingMember,
    outstandingConsentMembers
} from "../services/eventConsentManagementLogic";

export default function EventConsentManagement() {
    const [events, setEvents] = useState<EventRecord[]>([]);
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [links, setLinks] = useState<PublicEventLink[]>([]);
    const [responses, setResponses] = useState<Record<string, EventConsentResponse[]>>({});
    const [selectedMembers, setSelectedMembers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [workingEventId, setWorkingEventId] = useState("");
    const [workingResponseId, setWorkingResponseId] = useState("");
    const [workingNotification, setWorkingNotification] = useState("");
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

    const storeLink = (link: PublicEventLink) => {
        setLinks((current) => [
            link,
            ...current.filter((item) => item.eventId !== link.eventId)
        ]);
    };

    const createOrRefreshLink = async (event: EventRecord) => {
        setWorkingEventId(event.id);
        setError("");
        setMessage("");
        try {
            const link = await ensurePublicEventLink(event);
            storeLink(link);
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

    const sendNotification = async (event: EventRecord, kind: EventNotificationKind) => {
        const key = `${event.id}:${kind}`;
        setWorkingNotification(key);
        setError("");
        setMessage("");
        try {
            let link = linkFor(event.id);
            if (!link?.active) {
                link = await ensurePublicEventLink(event);
                storeLink(link);
            }
            if (!link.active) {
                setError("Open the event before sending parent notifications.");
                return;
            }

            const eligible = eligibleEventMembers(event, members);
            const targets = kind === "reminder"
                ? outstandingConsentMembers(event, members)
                : eligible;

            if (targets.length === 0) {
                setMessage(kind === "reminder" ? "No outstanding consent reminders are needed." : "No active members are eligible for this event.");
                return;
            }

            await notifyEventParents(
                event.id,
                targets.map((member) => member.id),
                link.token,
                kind
            );

            const label = kind === "reminder" ? "consent reminder" : kind === "update" ? "event update" : "event notice";
            setMessage(`${label.charAt(0).toUpperCase() + label.slice(1)} queued for ${targets.length} member${targets.length === 1 ? "" : "s"}.`);
        } catch (notificationError) {
            console.error("Unable to send event notification:", notificationError);
            setError("Unable to send the event notification. Check the email Worker logs if this continues.");
        } finally {
            setWorkingNotification("");
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
            const attendance: Record<string, AttendanceStatus> = { ...event.attendance };
            const consent: Record<string, EventConsentStatus> = { ...event.consent };
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
                await Promise.allSettled(
                    matchedResponses.map((item) =>
                        notifyEventConsentProcessed(event.id, item.memberId)
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

    const manualMatch = async (event: EventRecord, response: EventConsentResponse) => {
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
            try {
                await notifyEventConsentProcessed(event.id, memberId);
            } catch (emailError) {
                console.error("Unable to send event response confirmation:", emailError);
            }
            await load();
            const member = members.find((candidate) => candidate.id === memberId);
            setMessage(`Response for ${response.childName} matched to ${member?.displayName || "the selected member"}.`);
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
                    description="Create parent-facing event links, send event notices and reminders, review responses and sync them into the event roster."
                    actions={<Button variant="outlined" color="secondary" onClick={() => void load()}>Refresh</Button>}
                />

                {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                <Alert severity="info" sx={{ mb: 3 }}>
                    Event emails are sent only to parent email addresses already stored on member records for sections you can access. In current email test mode, messages are redirected to the configured test mailbox.
                </Alert>

                {loading ? (
                    <Box sx={{ minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <CircularProgress color="success" />
                    </Box>
                ) : (
                    <Box sx={{ display: "grid", gap: 2 }}>
                        {consentEvents.length === 0 && (
                            <Alert severity="info">No events currently require consent. Enable “Consent required” on an event first.</Alert>
                        )}

                        {consentEvents.map((event) => (
                            <EventConsentEventPanel
                                key={event.id}
                                event={event}
                                members={members}
                                link={linkFor(event.id)}
                                responses={responses[event.id] || []}
                                selectedMembers={selectedMembers}
                                workingEventId={workingEventId}
                                workingResponseId={workingResponseId}
                                workingNotification={workingNotification}
                                onSelectedMemberChange={(responseId, memberId) =>
                                    setSelectedMembers((current) => ({ ...current, [responseId]: memberId }))
                                }
                                onCreateOrRefreshLink={(item) => void createOrRefreshLink(item)}
                                onCopyLink={(item) => void copyLink(item)}
                                onSendNotification={(item, kind) => void sendNotification(item, kind)}
                                onSyncResponses={(item) => void syncResponses(item)}
                                onManualMatch={(item, response) => void manualMatch(item, response)}
                                onIgnoreResponse={(response) => void ignoreResponse(response)}
                            />
                        ))}
                    </Box>
                )}
            </Container>
        </Box>
    );
}
