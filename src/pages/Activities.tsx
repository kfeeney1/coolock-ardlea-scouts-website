import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    Container,
    Paper,
    Stack,
    Typography
} from "@mui/material";
import { useEffect, useState } from "react";

import { loadUpcomingPublicEvents } from "../services/publicEvents";
import type { PublicEvent } from "../services/publicEvents";
import { usePublicSiteContent } from "../components/PublicSiteContentProvider";

function formatDate(value: string): string {
    if (!value) return "Date to be confirmed";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-IE", { dateStyle: "full" }).format(date);
}

function dateRange(event: PublicEvent): string {
    if (!event.endDate || event.endDate === event.startDate) return formatDate(event.startDate);
    return `${formatDate(event.startDate)} – ${formatDate(event.endDate)}`;
}

export default function Activities() {
    const content = usePublicSiteContent();
    const [events, setEvents] = useState<PublicEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        void (async () => {
            try {
                setEvents(await loadUpcomingPublicEvents());
            } catch (loadError) {
                console.error("Unable to load upcoming activities:", loadError);
                setError("Unable to load upcoming activities at the moment.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <Box sx={{ backgroundColor: "background.default", minHeight: "70vh", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="lg">
                <Typography variant="h3" color="secondary" sx={{ fontWeight: 800 }}>
                    {content.activities.title}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>
                    {content.activities.intro}
                </Typography>

                {loading && <Box sx={{ minHeight: 220, display: "grid", placeItems: "center" }}><CircularProgress color="success" /></Box>}
                {error && <Alert severity="error">{error}</Alert>}
                {!loading && !error && events.length === 0 && <Alert severity="info">{content.activities.emptyMessage}</Alert>}

                {!loading && !error && events.length > 0 && (
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2.5 }}>
                        {events.map((event) => (
                            <Paper key={event.id} variant="outlined" sx={{ p: 3, borderTop: "5px solid", borderTopColor: "secondary.main" }}>
                                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1, mb: 1.5 }}>
                                    <Chip label={event.eventType} color="secondary" size="small" />
                                    <Chip label={event.section} variant="outlined" size="small" />
                                </Stack>
                                <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>{event.title}</Typography>
                                <Typography sx={{ mt: 1, fontWeight: 700 }}>{dateRange(event)}</Typography>
                                {event.location && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{event.location}</Typography>}
                                {event.description && <Typography sx={{ mt: 2, whiteSpace: "pre-wrap" }}>{event.description}</Typography>}
                            </Paper>
                        ))}
                    </Box>
                )}
            </Container>
        </Box>
    );
}
