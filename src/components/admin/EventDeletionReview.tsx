import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import type { EventRecord } from "../../services/eventAdmin";
import { inspectEventDeletion } from "../../services/eventDeletion";
import type { EventDeletionPreflight } from "../../services/eventDeletion";
import { applicationErrorMessage } from "../../services/applicationErrors.ts";
import { formatSiteDate } from "../../services/siteDateFormat";

export default function EventDeletionReview({ event }: { event: EventRecord }) {
  const [authorised, setAuthorised] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preflight, setPreflight] = useState<EventDeletionPreflight | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAuthorised(false);
    const user = auth.currentUser;
    if (user) void getDoc(doc(db, "adminUsers", user.uid)).then((profile) => {
      if (cancelled) return;
      const data = profile.data();
      setAuthorised(profile.exists() && data?.active === true && data.role === "super-admin"
        && Array.isArray(data.sections) && data.sections.length > 0
        && !Object.prototype.hasOwnProperty.call(data, "section"));
    }).catch(() => { if (!cancelled) setAuthorised(false); });
    return () => { cancelled = true; };
  }, [event.id]);

  const inspect = async () => {
    if (!authorised) return;
    setOpen(true);
    setLoading(true);
    setError("");
    setPreflight(null);
    try {
      setPreflight(await inspectEventDeletion(event));
    } catch (failure) {
      setError(applicationErrorMessage(failure, "Unable to inspect this event safely.", "EventDeletionReview"));
    } finally {
      setLoading(false);
    }
  };

  if (!authorised) return null;
  return <>
    <Button variant="outlined" color="error" onClick={() => void inspect()}>Review deletion</Button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="event-deletion-review-title">
      <DialogTitle id="event-deletion-review-title">Review event deletion</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography><strong>{event.title}</strong></Typography>
          <Typography>{event.section} · {formatSiteDate(event.startDate)}{event.endDate !== event.startDate ? " to " + formatSiteDate(event.endDate) : ""}</Typography>
          {loading && <CircularProgress size={24} aria-label="Inspecting linked event data" />}
          {error && <Alert severity="error">{error}</Alert>}
          {preflight && <>
            <Typography>Gallery photos: {preflight.photoCount > 0 ? "At least one photo found" : "None found in the checked gallery path"}</Typography>
            <Alert severity="warning">Deletion is disabled until a trusted service can safely reconcile linked records.</Alert>
            {preflight.blockers.map((blocker) => <Typography key={blocker} variant="body2">• {blocker}</Typography>)}
          </>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>Close</Button></DialogActions>
    </Dialog>
  </>;
}
