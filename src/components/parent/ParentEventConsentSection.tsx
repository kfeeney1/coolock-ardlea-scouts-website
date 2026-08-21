import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Paper,
    Stack,
    Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
    loadParentEventConsentLinks
} from "../../services/parentEvents";
import type { ParentEventConsentLink } from "../../services/parentEvents";

type Props = {
    sections: string[];
};

function formatDate(value: string): string {
    if (!value) return "Date not set";
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(date);
}

export default function ParentEventConsentSection({ sections }: Props) {
    const [events, setEvents] = useState<ParentEventConsentLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            setLoading(true);
            setError("");
            try {
                const loaded = await loadParentEventConsentLinks(sections);
                if (!cancelled) setEvents(loaded);
            } catch (loadError) {
                console.error("Unable to load parent event consent links:", loadError);
                if (!cancelled) setError("Unable to load upcoming event consent requests.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [sections]);

    if (loading) {
        return <Box sx={{ minHeight: 120, display: "grid", placeItems: "center" }}><CircularProgress size={28} /></Box>;
    }

    if (error) return <Alert severity="error">{error}</Alert>;

    if (sections.length === 0) {
        return <Alert severity="info">No linked Scout section is available for this account yet.</Alert>;
    }

    if (events.length === 0) {
        return <Alert severity="info">There are no upcoming consent requests for your linked sections at the moment.</Alert>;
    }

    return (
        <Stack spacing={2}>
            {events.map((event) => (
                <Paper key={event.token} variant="outlined" sx={{ p: 2.5 }}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                        <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{event.title}</Typography>
                        <Chip size="small" label={event.section} variant="outlined" />
                        {event.eventType && <Chip size="small" label={event.eventType} />}
                    </Stack>
                    <Typography sx={{ mt: 1, fontWeight: 700 }}>
                        {formatDate(event.startDate)}{event.endDate && event.endDate !== event.startDate ? ` – ${formatDate(event.endDate)}` : ""}
                    </Typography>
                    {event.location && <Typography color="text.secondary">{event.location}</Typography>}
                    {event.description && <Typography sx={{ mt: 1 }}>{event.description}</Typography>}
                    {event.meetingPoint && <Typography variant="body2" sx={{ mt: 1 }}><strong>Meeting:</strong> {event.meetingPoint}</Typography>}
                    {event.returnDetails && <Typography variant="body2"><strong>Return:</strong> {event.returnDetails}</Typography>}
                    <Button
                        component={Link}
                        to={`/event-consent/${event.token}`}
                        variant="contained"
                        color="success"
                        sx={{ mt: 2 }}
                    >
                        Complete Event Consent
                    </Button>
                </Paper>
            ))}
        </Stack>
    );
}
