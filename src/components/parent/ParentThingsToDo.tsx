import {
    Alert,
    Box,
    Button,
    Chip,
    Paper,
    Stack,
    Typography
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import {
    OperationalErrorState,
    OperationalLoading,
    OperationalPermissionState,
    OperationalUnavailableState
} from "../admin/OperationalStates";
import ParentWeeklyProgramme from "./ParentWeeklyProgramme";
import { loadLinkedMembers, loadParentConsents } from "../../services/parentConsent";
import { loadParentEventConsentLinks } from "../../services/parentEvents";
import { summariseParentTasks, type ParentTaskSummary } from "../../services/parentTasksLogic";
import { classifyFirestoreFailure, firestoreFailureMessage } from "../../services/firestoreErrors";

type Props = {
    memberIds: string[];
    sections: string[];
};

const emptySummary: ParentTaskSummary = {
    eventConsentCount: 0,
    medicalAttentionCount: 0,
    upcomingEventCount: 0,
    totalAttentionCount: 0,
    nextEvent: null,
    nextConsentEvent: null
};

function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function eventDate(startDate: string, endDate: string): string {
    if (!startDate) return "Date to be confirmed";
    if (endDate && endDate !== startDate) return `${startDate} to ${endDate}`;
    return startDate;
}

export default function ParentThingsToDo({ memberIds, sections }: Props) {
    const [summary, setSummary] = useState<ParentTaskSummary>(emptySummary);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<unknown>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [events, members, consents] = await Promise.all([
                loadParentEventConsentLinks(sections),
                loadLinkedMembers(memberIds),
                loadParentConsents(memberIds)
            ]);
            setSummary(summariseParentTasks(events, members, consents));
        } catch (error) {
            console.error("Unable to load parent task summary:", error);
            setLoadError(error);
        } finally {
            setLoading(false);
        }
    }, [memberIds, sections]);

    useEffect(() => {
        void load();
    }, [load]);

    const taskState = () => {
        if (memberIds.length === 0 && sections.length === 0) {
            return (
                <OperationalUnavailableState title="Things to do not available yet" testId="parent-things-to-do-unavailable">
                    Your parent account is approved but no child or section links are available yet. Ask a leader to review Parent Access.
                </OperationalUnavailableState>
            );
        }

        if (loading) {
            return <OperationalLoading minHeight={120} label="Loading your things to do" />;
        }

        if (loadError) {
            const message = firestoreFailureMessage(loadError, "Unable to load your things-to-do summary right now.");
            if (classifyFirestoreFailure(loadError) === "permission") {
                return (
                    <OperationalPermissionState
                        title="Things to do access restricted"
                        actionLabel="Retry"
                        onAction={() => void load()}
                        testId="parent-things-to-do-permission"
                    >
                        {message}
                    </OperationalPermissionState>
                );
            }
            return (
                <OperationalErrorState
                    title="Things to do could not be loaded"
                    actionLabel="Retry"
                    onAction={() => void load()}
                    testId="parent-things-to-do-error"
                >
                    {message}
                </OperationalErrorState>
            );
        }

        return (
            <>
                {summary.totalAttentionCount === 0 ? (
                    <Alert severity="success" sx={{ mb: 2 }} role="status">
                        Nothing needs your attention right now.
                    </Alert>
                ) : (
                    <Alert severity="info" sx={{ mb: 2 }} role="status">
                        You have {summary.totalAttentionCount} item{summary.totalAttentionCount === 1 ? "" : "s"} to review.
                    </Alert>
                )}

                {summary.nextConsentEvent && (
                    <Paper variant="outlined" sx={{ p: 2.25, mb: 2 }} data-testid="parent-next-action">
                        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}>
                            <Box>
                                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                                    <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>Next action</Typography>
                                    <Chip label="Consent required" color="warning" size="small" />
                                </Stack>
                                <Typography sx={{ mt: 0.75, fontWeight: 700 }}>{summary.nextConsentEvent.title}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {eventDate(summary.nextConsentEvent.startDate, summary.nextConsentEvent.endDate)} · {summary.nextConsentEvent.section}{summary.nextConsentEvent.location ? ` · ${summary.nextConsentEvent.location}` : ""}
                                </Typography>
                            </Box>
                            <Button variant="contained" color="warning" onClick={() => scrollTo("parent-event-consent")}>Review consent</Button>
                        </Stack>
                    </Paper>
                )}

                {!summary.nextConsentEvent && summary.nextEvent && (
                    <Paper variant="outlined" sx={{ p: 2.25, mb: 2 }} data-testid="parent-next-event">
                        <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>Next upcoming event</Typography>
                        <Typography sx={{ mt: 0.75, fontWeight: 700 }}>{summary.nextEvent.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {eventDate(summary.nextEvent.startDate, summary.nextEvent.endDate)} · {summary.nextEvent.section}{summary.nextEvent.location ? ` · ${summary.nextEvent.location}` : ""}
                        </Typography>
                        <Button onClick={() => scrollTo("parent-event-consent")} sx={{ mt: 1, px: 0 }}>View event details</Button>
                    </Paper>
                )}

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
                    <Paper variant="outlined" sx={{ p: 2.25 }}>
                        <Typography variant="h3" color="secondary" sx={{ fontWeight: 800 }}>{summary.eventConsentCount}</Typography>
                        <Typography sx={{ fontWeight: 700 }}>Event consent</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Upcoming consent request{summary.eventConsentCount === 1 ? "" : "s"} for linked sections.</Typography>
                        <Button onClick={() => scrollTo("parent-event-consent")} sx={{ mt: 1.5, px: 0 }}>Review events</Button>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2.25 }}>
                        <Typography variant="h3" color="secondary" sx={{ fontWeight: 800 }}>{summary.medicalAttentionCount}</Typography>
                        <Typography sx={{ fontWeight: 700 }}>Medical & consent</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Linked child record{summary.medicalAttentionCount === 1 ? "" : "s"} missing a parent-reviewed consent update.</Typography>
                        <Button onClick={() => scrollTo("parent-medical-consent")} sx={{ mt: 1.5, px: 0 }}>Review forms</Button>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2.25 }}>
                        <Typography variant="h3" color="secondary" sx={{ fontWeight: 800 }}>{summary.upcomingEventCount}</Typography>
                        <Typography sx={{ fontWeight: 700 }}>Upcoming events</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Event{summary.upcomingEventCount === 1 ? "" : "s"} currently visible for your linked sections.</Typography>
                        <Button onClick={() => scrollTo("parent-event-consent")} sx={{ mt: 1.5, px: 0 }}>View events</Button>
                    </Paper>
                </Box>

                <ParentWeeklyProgramme sections={sections} />
            </>
        );
    };

    return (
        <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }} data-testid="parent-things-to-do">
            <Typography variant="h4" color="secondary" sx={{ fontWeight: 800 }}>
                Things to do
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                Your next actions, upcoming events and weekly programme in one place.
            </Typography>
            {taskState()}
        </Paper>
    );
}
