import {
    Box,
    Button,
    Chip,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Typography
} from "@mui/material";

import type { EventRecord } from "../../services/eventAdmin";
import type { MemberRecord } from "../../services/memberAdmin";
import type { EventConsentResponse, PublicEventLink } from "../../services/eventConsent";
import type { EventNotificationKind } from "../../services/emailNotifications";
import { eventConsentSummary } from "../../services/eventConsentManagementLogic";

function formatDate(value: Date | null): string {
    if (!value) return "Unknown";
    return new Intl.DateTimeFormat("en-IE", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(value);
}

type Props = {
    event: EventRecord;
    members: MemberRecord[];
    link: PublicEventLink | null;
    responses: EventConsentResponse[];
    selectedMembers: Record<string, string>;
    workingEventId: string;
    workingResponseId: string;
    workingNotification: string;
    onSelectedMemberChange: (responseId: string, memberId: string) => void;
    onCreateOrRefreshLink: (event: EventRecord) => void;
    onCopyLink: (link: PublicEventLink) => void;
    onSendNotification: (event: EventRecord, kind: EventNotificationKind) => void;
    onSyncResponses: (event: EventRecord) => void;
    onManualMatch: (event: EventRecord, response: EventConsentResponse) => void;
    onIgnoreResponse: (response: EventConsentResponse) => void;
};

export default function EventConsentEventPanel({
    event,
    members,
    link,
    responses,
    selectedMembers,
    workingEventId,
    workingResponseId,
    workingNotification,
    onSelectedMemberChange,
    onCreateOrRefreshLink,
    onCopyLink,
    onSendNotification,
    onSyncResponses,
    onManualMatch,
    onIgnoreResponse
}: Props) {
    const summary = eventConsentSummary(event, members, responses);
    const {
        eligibleMembers,
        newResponses,
        matchedResponses,
        ignoredResponses,
        unmatchedResponses,
        received,
        outstanding,
        changedDetails
    } = summary;

    return (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                        <Typography variant="h5" color="secondary">{event.title}</Typography>
                        <Chip label={event.status} size="small" variant="outlined" />
                        <Chip label={`${eligibleMembers.length} members`} size="small" />
                        <Chip label={`${received} consent received`} size="small" color="success" />
                        <Chip label={`${outstanding} outstanding`} size="small" color={outstanding ? "warning" : "default"} />
                        <Chip label={`${newResponses.length} new responses`} size="small" color={newResponses.length ? "warning" : "default"} />
                        {unmatchedResponses.length > 0 && <Chip label={`${unmatchedResponses.length} unmatched`} size="small" color="error" />}
                        {changedDetails > 0 && <Chip label={`${changedDetails} details changed`} size="small" color="warning" />}
                    </Stack>

                    <Typography sx={{ mt: 1 }}>
                        {event.startDate}{event.location ? ` · ${event.location}` : ""}
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
                                    <Paper key={response.id} variant="outlined" sx={{ p: 2, borderLeft: "5px solid", borderLeftColor: "error.main" }}>
                                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
                                            <Chip label="Needs manual matching" color="error" size="small" />
                                            <Chip label={response.attendance === "attending" ? "Attending" : "Not attending"} size="small" variant="outlined" />
                                            <Chip label={response.consentGiven ? "Consent given" : "Consent not given"} size="small" color={response.consentGiven ? "success" : "warning"} />
                                        </Stack>
                                        <Typography sx={{ fontWeight: 700 }}>Child: {response.childName || "Not supplied"}</Typography>
                                        <Typography variant="body2">Date of birth: {response.dateOfBirth || "Not supplied"}</Typography>
                                        <Typography variant="body2">Parent / Guardian: {response.parentName || "Not supplied"}</Typography>
                                        <Typography variant="body2">Emergency details confirmed: {response.emergencyDetailsConfirmed ? "Yes" : "No"}</Typography>
                                        <Typography variant="body2">Medical / emergency information changed: {response.medicalDetailsChanged ? "Yes" : "No"}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Submitted: {formatDate(response.submittedAt)}</Typography>
                                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} sx={{ mt: 2 }}>
                                            <FormControl size="small" sx={{ minWidth: 280, flex: 1 }}>
                                                <InputLabel>Match to member</InputLabel>
                                                <Select
                                                    label="Match to member"
                                                    value={selectedMembers[response.id] || ""}
                                                    onChange={(changeEvent) => onSelectedMemberChange(response.id, changeEvent.target.value)}
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
                                                onClick={() => onManualMatch(event, response)}
                                            >
                                                Match to Member
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                disabled={workingResponseId === response.id}
                                                onClick={() => onIgnoreResponse(response)}
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
                            <Typography variant="h6" color="secondary" sx={{ fontWeight: 800, mb: 1 }}>Processed Responses</Typography>
                            <Box sx={{ display: "grid", gap: 1 }}>
                                {[...matchedResponses, ...ignoredResponses].map((response) => {
                                    const matchedMember = members.find((member) => member.id === response.matchedMemberId);
                                    return (
                                        <Paper key={response.id} variant="outlined" sx={{ p: 1.5 }}>
                                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                                                <Chip label={response.processingStatus === "matched" ? "Matched" : "Ignored"} color={response.processingStatus === "matched" ? "success" : "default"} size="small" />
                                                <Typography sx={{ fontWeight: 700 }}>{response.childName}</Typography>
                                                {matchedMember && <Typography variant="body2" color="text.secondary">→ {matchedMember.displayName}</Typography>}
                                                <Typography variant="body2" color="text.secondary">{formatDate(response.processedAt)}</Typography>
                                            </Stack>
                                        </Paper>
                                    );
                                })}
                            </Box>
                        </Box>
                    )}
                </Box>

                <Stack spacing={1.25} sx={{ minWidth: { lg: 230 } }}>
                    <Button
                        variant={link?.active ? "outlined" : "contained"}
                        color="secondary"
                        disabled={workingEventId === event.id}
                        onClick={() => onCreateOrRefreshLink(event)}
                    >
                        {link ? "Refresh Parent Link" : "Create Parent Link"}
                    </Button>
                    {link && <Button variant="outlined" color="secondary" onClick={() => onCopyLink(link)}>Copy Parent Link</Button>}
                    <Divider />
                    <Button variant="contained" color="secondary" disabled={event.status !== "open" || workingNotification !== ""} onClick={() => onSendNotification(event, "notice")}>
                        {workingNotification === `${event.id}:notice` ? "Sending…" : "Send Event Notice"}
                    </Button>
                    <Button variant="outlined" color="secondary" disabled={event.status !== "open" || workingNotification !== ""} onClick={() => onSendNotification(event, "update")}>
                        {workingNotification === `${event.id}:update` ? "Sending…" : "Send Event Update"}
                    </Button>
                    <Button variant="contained" color="warning" disabled={event.status !== "open" || outstanding === 0 || workingNotification !== ""} onClick={() => onSendNotification(event, "reminder")}>
                        {workingNotification === `${event.id}:reminder` ? "Sending…" : `Send Consent Reminders (${outstanding})`}
                    </Button>
                    <Divider />
                    <Button variant="contained" color="success" disabled={workingEventId === event.id || newResponses.length === 0} onClick={() => onSyncResponses(event)}>
                        Sync New Responses
                    </Button>
                </Stack>
            </Box>
        </Paper>
    );
}
