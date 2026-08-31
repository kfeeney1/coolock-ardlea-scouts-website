import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";

import type { EventRecord } from "../../services/eventAdmin";
import { deleteEventGalleryPhoto, loadEventGalleryPhotos, uploadEventGalleryPhoto } from "../../services/eventGallery";
import type { EventGalleryPhoto } from "../../services/eventGallery";
import { recordAuditEvent } from "../../services/auditLog";

type Props = { event: EventRecord | null; onClose: () => void };

export default function EventGalleryDialog({ event, onClose }: Props) {
    const [photos, setPhotos] = useState<EventGalleryPhoto[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const galleryInput = useRef<HTMLInputElement>(null);
    const cameraInput = useRef<HTMLInputElement>(null);

    const refresh = async () => {
        if (!event) return;
        setLoading(true);
        setError("");
        try { setPhotos(await loadEventGalleryPhotos(event.section, event.id)); }
        catch (loadError) { console.error("Unable to load event gallery:", loadError); setError("Unable to load this event gallery."); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (event) void refresh(); else setPhotos([]); }, [event?.id]);

    const uploadFiles = async (files: FileList | null) => {
        if (!event || !files?.length) return;
        setUploading(true); setError(""); setMessage("");
        const results = await Promise.allSettled(Array.from(files).map((file) => uploadEventGalleryPhoto(event.section, event.id, file)));
        const uploaded = results.filter((result) => result.status === "fulfilled").length;
        const failed = results.length - uploaded;
        if (uploaded) {
            await recordAuditEvent({ category: "event", action: "gallery-photo-uploaded", targetId: event.id, targetLabel: event.title, section: event.section, description: `${uploaded} event gallery photo${uploaded === 1 ? "" : "s"} uploaded.` });
            setMessage(`${uploaded} photo${uploaded === 1 ? "" : "s"} uploaded${failed ? `; ${failed} failed.` : "."}`);
            await refresh();
        }
        if (failed && !uploaded) setError("The selected photo(s) could not be uploaded. Use JPEG, PNG or WebP images up to 10 MB each.");
        setUploading(false);
        if (galleryInput.current) galleryInput.current.value = "";
        if (cameraInput.current) cameraInput.current.value = "";
    };

    const removePhoto = async (photo: EventGalleryPhoto) => {
        if (!event || !window.confirm(`Remove ${photo.fileName} from this gallery?`)) return;
        setError(""); setMessage("");
        try {
            await deleteEventGalleryPhoto(photo);
            await recordAuditEvent({ category: "event", action: "gallery-photo-removed", targetId: event.id, targetLabel: event.title, section: event.section, description: `Removed event gallery photo ${photo.fileName}.` });
            setMessage("Photo removed.");
            await refresh();
        } catch (deleteError) { console.error("Unable to remove gallery photo:", deleteError); setError("Unable to remove that photo."); }
    };

    return <Dialog open={Boolean(event)} onClose={uploading ? undefined : onClose} fullWidth maxWidth="md">
        <DialogTitle>{event ? `${event.title} · Gallery` : "Event Gallery"}</DialogTitle>
        <DialogContent dividers>
            <Stack spacing={2}>
                <Alert severity="info">Leader-only gallery. Parent access remains disabled until explicit photo-sharing consent is available.</Alert>
                {message && <Alert severity="success">{message}</Alert>}
                {error && <Alert severity="error">{error}</Alert>}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <Button variant="contained" color="success" disabled={uploading} onClick={() => galleryInput.current?.click()}>Add photos</Button>
                    <Button variant="outlined" color="success" disabled={uploading} onClick={() => cameraInput.current?.click()}>Take photo</Button>
                    {uploading && <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><CircularProgress size={20} /><Typography variant="body2">Uploading…</Typography></Box>}
                </Stack>
                <input ref={galleryInput} hidden type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Choose gallery photos" onChange={(e) => void uploadFiles(e.target.files)} />
                <input ref={cameraInput} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="Take gallery photo" onChange={(e) => void uploadFiles(e.target.files)} />
                {loading ? <Box sx={{ py: 6, textAlign: "center" }}><CircularProgress /></Box> : photos.length === 0 ? <Alert severity="info">No photos have been added to this event yet.</Alert> : <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.5 }}>
                    {photos.map((photo) => <Box key={photo.path} sx={{ position: "relative", borderRadius: 1, overflow: "hidden", border: 1, borderColor: "divider", aspectRatio: "1 / 1" }}>
                        <Box component="img" src={photo.downloadUrl} alt={photo.fileName} loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <IconButton aria-label={`Remove ${photo.fileName}`} size="small" onClick={() => void removePhoto(photo)} sx={{ position: "absolute", top: 6, right: 6, bgcolor: "background.paper", "&:hover": { bgcolor: "background.paper" } }}>×</IconButton>
                    </Box>)}
                </Box>}
            </Stack>
        </DialogContent>
        <DialogActions><Button onClick={onClose} disabled={uploading}>Close</Button></DialogActions>
    </Dialog>;
}
