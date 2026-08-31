import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useMemo, useState } from "react";

import {
    loadParentEventGalleries,
    revokeParentEventGalleryUrls
} from "../../services/parentEventGalleries";
import type {
    ParentEventGallery,
    ParentGalleryPhoto
} from "../../services/parentEventGalleries";

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

export default function ParentEventGallerySection({ sections }: Props) {
    const [galleries, setGalleries] = useState<ParentEventGallery[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [selectedPhoto, setSelectedPhoto] = useState<ParentGalleryPhoto | null>(null);
    const [retryVersion, setRetryVersion] = useState(0);

    useEffect(() => {
        let cancelled = false;
        let loaded: ParentEventGallery[] = [];

        setSelectedPhoto(null);
        setGalleries((current) => {
            revokeParentEventGalleryUrls(current);
            return [];
        });

        void (async () => {
            setLoading(true);
            setError("");
            try {
                loaded = await loadParentEventGalleries(sections);
                if (cancelled) {
                    revokeParentEventGalleryUrls(loaded);
                    loaded = [];
                    return;
                }
                setGalleries(loaded);
            } catch (loadError) {
                console.error("Unable to load parent event galleries:", loadError);
                if (!cancelled) setError("Unable to load event galleries right now. Please try again later.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            revokeParentEventGalleryUrls(loaded);
        };
    }, [sections, retryVersion]);

    const visible = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return galleries;
        return galleries.filter((gallery) =>
            [gallery.title, gallery.section, gallery.eventType, gallery.location, gallery.description]
                .join(" ")
                .toLowerCase()
                .includes(query)
        );
    }, [galleries, search]);

    if (loading) {
        return <Box sx={{ minHeight: 120, display: "grid", placeItems: "center" }} aria-live="polite"><CircularProgress size={28} aria-label="Loading event galleries" /></Box>;
    }
    if (error) {
        return (
            <Alert
                severity="error"
                action={<Button color="inherit" size="small" onClick={() => setRetryVersion((version) => version + 1)}>Retry</Button>}
                data-testid="parent-event-gallery-error"
            >
                {error}
            </Alert>
        );
    }
    if (sections.length === 0) return <Alert severity="info">No linked Scout section is available for this account yet.</Alert>;
    if (galleries.length === 0) {
        return (
            <Alert severity="info" data-testid="parent-event-gallery-empty">
                There are no event galleries available for your account. Galleries only appear when an eligible linked child attended the event and current photo-sharing consent allows access.
            </Alert>
        );
    }

    return (
        <Stack spacing={2} data-testid="parent-event-galleries">
            <Alert severity="info">
                These photos are available only through your signed-in parent account. Please respect the privacy of other young people shown in group photos and do not redistribute images without permission.
            </Alert>
            <TextField
                fullWidth
                label="Search event galleries"
                placeholder="Event, section or location"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                slotProps={{ htmlInput: { "data-testid": "parent-event-gallery-search" } }}
            />
            <Typography variant="body2" color="text.secondary" aria-live="polite">
                Showing {visible.length} of {galleries.length} available event galler{galleries.length === 1 ? "y" : "ies"}.
            </Typography>
            <Stack spacing={3}>
                {visible.map((gallery) => (
                    <Paper key={gallery.eventId} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }} data-testid={`parent-event-gallery-${gallery.eventId}`}>
                        <Stack spacing={0.5} sx={{ mb: 2 }}>
                            <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{gallery.title}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {formatDate(gallery.startDate)}{gallery.endDate && gallery.endDate !== gallery.startDate ? ` – ${formatDate(gallery.endDate)}` : ""} · {gallery.section}
                            </Typography>
                            {gallery.location && <Typography variant="body2" color="text.secondary">{gallery.location}</Typography>}
                        </Stack>
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
                                gap: 1.5
                            }}
                        >
                            {gallery.photos.map((photo) => (
                                <Box
                                    component="button"
                                    type="button"
                                    key={photo.path}
                                    onClick={() => setSelectedPhoto(photo)}
                                    aria-label={`Open ${photo.fileName}`}
                                    sx={{
                                        border: 0,
                                        p: 0,
                                        background: "transparent",
                                        cursor: "pointer",
                                        borderRadius: 1,
                                        overflow: "hidden",
                                        aspectRatio: "1 / 1",
                                        "&:focus-visible": { outline: "3px solid", outlineColor: "primary.main", outlineOffset: 2 }
                                    }}
                                >
                                    <Box
                                        component="img"
                                        src={photo.objectUrl}
                                        alt={photo.fileName}
                                        loading="lazy"
                                        sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                    />
                                </Box>
                            ))}
                        </Box>
                    </Paper>
                ))}
            </Stack>
            {visible.length === 0 && <Alert severity="info">No event galleries match that search.</Alert>}

            <Dialog
                open={Boolean(selectedPhoto)}
                onClose={() => setSelectedPhoto(null)}
                maxWidth="lg"
                fullWidth
                aria-labelledby="parent-gallery-photo-title"
            >
                <DialogTitle id="parent-gallery-photo-title" sx={{ pr: 7 }}>
                    {selectedPhoto?.fileName || "Event gallery photo"}
                </DialogTitle>
                <DialogContent sx={{ p: { xs: 0.5, sm: 1 }, position: "relative", backgroundColor: "background.default" }}>
                    <IconButton
                        aria-label="Close photo"
                        onClick={() => setSelectedPhoto(null)}
                        sx={{ position: "absolute", top: 8, right: 8, zIndex: 1, backgroundColor: "background.paper" }}
                    >
                        <CloseIcon />
                    </IconButton>
                    {selectedPhoto && (
                        <Box
                            component="img"
                            src={selectedPhoto.objectUrl}
                            alt={selectedPhoto.fileName}
                            sx={{ width: "100%", maxHeight: { xs: "72vh", sm: "80vh" }, objectFit: "contain", display: "block" }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </Stack>
    );
}
