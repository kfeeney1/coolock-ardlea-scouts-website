import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Paper,
    Typography
} from "@mui/material";
import { useEffect, useState } from "react";

import { loadLinkedMembers, loadParentConsents } from "../../services/parentConsent";
import { loadParentEventConsentLinks } from "../../services/parentEvents";
import { summariseParentTasks, type ParentTaskSummary } from "../../services/parentTasksLogic";

type Props = {
    memberIds: string[];
    sections: string[];
};

const emptySummary: ParentTaskSummary = {
    eventConsentCount: 0,
    medicalAttentionCount: 0,
    upcomingEventCount: 0,
    totalAttentionCount: 0
};

function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function ParentThingsToDo({ memberIds, sections }: Props) {
    const [summary, setSummary] = useState<ParentTaskSummary>(emptySummary);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            setLoading(true);
            setError("");
            try {
                const [events, members, consents] = await Promise.all([
                    loadParentEventConsentLinks(sections),
                    loadLinkedMembers(memberIds),
                    loadParentConsents(memberIds)
                ]);
                if (!cancelled) setSummary(summariseParentTasks(events, members, consents));
            } catch (loadError) {
                console.error("Unable to load parent task summary:", loadError);
                if (!cancelled) setError("Unable to load your things-to-do summary right now.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [memberIds, sections]);

    return (
        <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }} data-testid="parent-things-to-do">
            <Typography variant="h4" color="secondary" sx={{ fontWeight: 800 }}>
                Things to do
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                A quick view of consent and medical information that may need your attention.
            </Typography>

            {loading ? (
                <Box sx={{ minHeight: 120, display: "grid", placeItems: "center" }}>
                    <CircularProgress size={28} />
                </Box>
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : (
                <>
                    {summary.totalAttentionCount === 0 ? (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            Nothing needs your attention right now.
                        </Alert>
                    ) : (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            You have {summary.totalAttentionCount} item{summary.totalAttentionCount === 1 ? "" : "s"} to review.
                        </Alert>
                    )}

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
                        <Paper variant="outlined" sx={{ p: 2.25 }}>
                            <Typography variant="h3" color="secondary" sx={{ fontWeight: 800 }}>
                                {summary.eventConsentCount}
                            </Typography>
                            <Typography sx={{ fontWeight: 700 }}>Event consent</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Upcoming consent request{summary.eventConsentCount === 1 ? "" : "s"} for linked sections.
                            </Typography>
                            <Button onClick={() => scrollTo("parent-event-consent")} sx={{ mt: 1.5, px: 0 }}>
                                Review events
                            </Button>
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 2.25 }}>
                            <Typography variant="h3" color="secondary" sx={{ fontWeight: 800 }}>
                                {summary.medicalAttentionCount}
                            </Typography>
                            <Typography sx={{ fontWeight: 700 }}>Medical & consent</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Linked child record{summary.medicalAttentionCount === 1 ? "" : "s"} missing a parent-reviewed consent update.
                            </Typography>
                            <Button onClick={() => scrollTo("parent-medical-consent")} sx={{ mt: 1.5, px: 0 }}>
                                Review forms
                            </Button>
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 2.25 }}>
                            <Typography variant="h3" color="secondary" sx={{ fontWeight: 800 }}>
                                {summary.upcomingEventCount}
                            </Typography>
                            <Typography sx={{ fontWeight: 700 }}>Upcoming events</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Event{summary.upcomingEventCount === 1 ? "" : "s"} currently visible for your linked sections.
                            </Typography>
                            <Button onClick={() => scrollTo("parent-event-consent")} sx={{ mt: 1.5, px: 0 }}>
                                View events
                            </Button>
                        </Paper>
                    </Box>
                </>
            )}
        </Paper>
    );
}
