import { reportApplicationError } from "../../services/applicationErrors.ts";
import {
    Box,
    Button,
    Paper,
    Stack,
    Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useState } from "react";

import {
    OperationalErrorState,
    OperationalLoading,
    OperationalPermissionState,
    OperationalUnavailableState
} from "../admin/OperationalStates";
import ParentWeeklyProgramme from "./ParentWeeklyProgramme";
import { loadLinkedMembers, loadParentConsents } from "../../services/parentConsent";
import { loadParentEventConsentLinks } from "../../services/parentEvents";
import { loadParentTaskSummary, type ParentTaskSummary } from "../../services/parentTasksLogic";
import { classifyFirestoreFailure, firestoreFailureMessage } from "../../services/firestoreErrors";
import { formatSiteDate } from "../../services/siteDateFormat";

type Props = {
    memberIds: string[];
    sections: string[];
    refreshVersion?: number;
    consentFlowsEnabled?: boolean;
};

const actionStyle = {
    minHeight: 44,
    "&.Mui-focusVisible": { outline: "2px solid", outlineOffset: 2 }
};

function scrollTo(id: string) {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });
}

function eventDate(startDate: string, endDate: string): string {
    if (!startDate) return "Date to be confirmed";
    if (endDate && endDate !== startDate) return `${formatSiteDate(startDate)} to ${formatSiteDate(endDate)}`;
    return formatSiteDate(startDate);
}

export default function ParentThingsToDo(props: Props) {
    // A child or consent setting change must discard the previous summary before rendering.
    const contextKey = JSON.stringify([props.memberIds, props.sections, props.consentFlowsEnabled]);
    return <ParentTaskSummaryPanel key={contextKey} {...props} />;
}

function ParentTaskSummaryPanel({ memberIds, sections, refreshVersion = 0, consentFlowsEnabled = false }: Props) {
    const [context] = useState({ memberIds, sections, consentFlowsEnabled });
    const [retryVersion, setRetryVersion] = useState(0);
    const [result, setResult] = useState<{
        revision: number;
        retry: number;
        outcome: { summary: ParentTaskSummary } | { error: unknown };
    } | null>(null);

    useEffect(() => {
        if (refreshVersion < 0 && retryVersion === 0) return;
        const { memberIds, sections, consentFlowsEnabled } = context;
        if (memberIds.length === 0 && sections.length === 0) return;
        let active = true;
        const load = async () => {
            try {
                const summary = await loadParentTaskSummary({
                    events: () => loadParentEventConsentLinks(memberIds, sections),
                    members: () => loadLinkedMembers(memberIds),
                    consents: () => consentFlowsEnabled ? loadParentConsents(memberIds) : Promise.resolve([])
                }, { eventConsentEnabled: consentFlowsEnabled });
                if (active) setResult({ revision: refreshVersion, retry: retryVersion, outcome: { summary } });
            } catch (error) {
                if (!active) return;
                const eventOperation = error && typeof error === "object" && "parentEventOperation" in error
                    ? Reflect.get(error, "parentEventOperation")
                    : undefined;
                const operation = typeof eventOperation === "string"
                    ? `Unable to load parent task summary: ${eventOperation}`
                    : "Unable to load parent task summary";
                reportApplicationError(error, { area: "ParentThingsToDo", operation });
                setResult({ revision: refreshVersion, retry: retryVersion, outcome: { error } });
            }
        };
        void load();
        return () => { active = false; };
    }, [context, refreshVersion, retryVersion]);

    const retry = () => setRetryVersion((version) => version + 1);

    const taskState = () => {
        if (memberIds.length === 0 && sections.length === 0) {
            return (
                <OperationalUnavailableState title="Things to do not available yet" testId="parent-things-to-do-unavailable">
                    Your parent account is approved but no child or section links are available yet. Ask a leader to review Parent Access.
                </OperationalUnavailableState>
            );
        }

        if (!result || result.retry !== retryVersion || (refreshVersion >= 0 && result.revision !== refreshVersion)) {
            return <OperationalLoading minHeight={120} label="Loading your things to do" />;
        }

        if ("error" in result.outcome) {
            const loadError = result.outcome.error;
            const message = firestoreFailureMessage(loadError, "Unable to load your things-to-do summary right now.");
            if (classifyFirestoreFailure(loadError) === "permission") {
                return (
                    <OperationalPermissionState
                        title="Things to do access restricted"
                        actionLabel="Retry"
                        onAction={retry}
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
                    onAction={retry}
                    testId="parent-things-to-do-error"
                >
                    {message}
                </OperationalErrorState>
            );
        }

        const { summary } = result.outcome;
        const attentionCount = summary.eventConsentCount + (consentFlowsEnabled ? summary.medicalAttentionCount : 0);
        const consentEvent = consentFlowsEnabled ? summary.nextConsentEvent : null;
        const event = consentEvent ?? summary.nextEvent;
        const eventTarget = "parent-event-consent";
        const counts = [
            ...(consentFlowsEnabled ? [
                { count: summary.eventConsentCount, label: "Event consent", action: "Review events", target: eventTarget },
                { count: summary.medicalAttentionCount, label: "Consent & Medical", action: "Review forms", target: "parent-medical-consent", testId: "parent-medical-attention-count" }
            ] : []),
            { count: summary.upcomingEventCount, label: "Upcoming events", action: "View events", target: eventTarget }
        ];

        return (
            <>
                <Typography role="status" variant="body2" sx={{ mb: 1, fontWeight: 700 }}>
                    {attentionCount === 0
                        ? "Nothing needs your attention right now."
                        : `${attentionCount} item${attentionCount === 1 ? "" : "s"} to review`}
                </Typography>
                {event && (
                    <Paper variant="outlined" data-testid={consentEvent ? "parent-next-action" : "parent-next-event"}
                        sx={(theme) => {
                            const accent = consentEvent ? theme.palette.warning.main : theme.palette.success.main;
                            return { p: 1.25, mb: 1, borderColor: accent, bgcolor: alpha(accent, 0.1) };
                        }}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}
                            sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {consentEvent ? "Consent required" : "Upcoming event"}
                                </Typography>
                                <Typography variant="subtitle1" color="secondary" sx={{ fontWeight: 800 }}>
                                    {event.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {eventDate(event.startDate, event.endDate)} · {event.section}{event.location ? ` · ${event.location}` : ""}
                                </Typography>
                            </Box>
                            <Button variant="contained" color="secondary" onClick={() => scrollTo(eventTarget)}
                                sx={{ ...actionStyle, flexShrink: { sm: 0 }, justifyContent: { xs: "flex-start", sm: "center" } }}>
                                {consentEvent ? "Review consent" : "View event details"}
                            </Button>
                        </Stack>
                    </Paper>
                )}
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: `repeat(${counts.length}, minmax(0, 1fr))` }, gap: 0.5 }}>
                    {counts.map(({ count, label, action, target, testId }) => (
                        <Box key={label} sx={{
                            display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 0.75,
                            justifyContent: { xs: "space-between", md: "flex-start" }
                        }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                <Box component="span" data-testid={testId} sx={{ mr: 1, color: "secondary.main" }}>{count}</Box>
                                <Box component="span">{label}</Box>
                            </Typography>
                            <Button variant="outlined" color="secondary" size="small" onClick={() => scrollTo(target)}
                                sx={{ ...actionStyle, textAlign: "left" }}>{action}</Button>
                        </Box>
                    ))}
                </Box>

                <ParentWeeklyProgramme sections={sections} childId={memberIds[0] ?? ""} />
            </>
        );
    };

    return (
        <Paper variant="outlined" sx={{ p: { xs: 1.25, md: 2 }, mb: 2, overflowWrap: "anywhere" }} data-testid="parent-things-to-do">
            <Typography component="h2" variant="h6" color="secondary" sx={{ fontWeight: 800 }}>
                Things to do
            </Typography>
            {taskState()}
        </Paper>
    );
}
