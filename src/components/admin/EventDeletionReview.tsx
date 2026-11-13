import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import type { EventRecord } from "../../services/eventAdmin";
import { deleteEventAfterReview, inspectEventDeletion } from "../../services/eventDeletion";
import type { EventDeletionPreflight } from "../../services/eventDeletion";
import { applicationErrorMessage } from "../../services/applicationErrors.ts";
import { formatSiteDate } from "../../services/siteDateFormat";

export default function EventDeletionReview({ event }: { event: EventRecord }) {
  const navigate = useNavigate();
  const [authorised, setAuthorised] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
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
    setConfirmation("");
    try {
      setPreflight(await inspectEventDeletion(event));
    } catch (failure) {
      setError(applicationErrorMessage(failure, "Unable to inspect this event safely.", "EventDeletionReview"));
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!preflight || preflight.blockers.length || confirmation !== preflight.event.title || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await deleteEventAfterReview(preflight, confirmation);
      setOpen(false);
      navigate("/leader/events", { replace: true });
    } catch (failure) {
      setError(applicationErrorMessage(failure, "Unable to delete this event. No success was confirmed.", "EventDeletionReview"));
      setPreflight(null);
      setConfirmation("");
    } finally {
      setDeleting(false);
    }
  };

  if (!authorised) return null;
  return <>
    <Button variant="outlined" color="error" onClick={() => void inspect()}>Review deletion</Button>
    <Dialog open={open} onClose={() => { if (!deleting) setOpen(false); }} fullWidth maxWidth="sm" aria-labelledby="event-deletion-review-title">
      <DialogTitle id="event-deletion-review-title">Review event deletion</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography><strong>{preflight?.event.title ?? event.title}</strong></Typography>
          <Typography>{preflight?.event.section ?? event.section} · {formatSiteDate(preflight?.event.startDate ?? event.startDate)}{(preflight?.event.endDate ?? event.endDate) !== (preflight?.event.startDate ?? event.startDate) ? " to " + formatSiteDate(preflight?.event.endDate ?? event.endDate) : ""}</Typography>
          {loading && <CircularProgress size={24} aria-label="Inspecting linked event data" />}
          {error && <Alert severity="error">{error}</Alert>}
          {preflight && <>
            <Typography>Gallery photos: {preflight.photoCountIsMinimum ? "More than 100 found (scan limited)" : `${preflight.photoCount} found in the checked gallery path`}</Typography>
            <Typography variant="subtitle2">Linked records checked</Typography>
            {Object.entries(preflight.linked).filter(([, evidence]) => evidence.count > 0).length === 0
              ? <Typography variant="body2">No linked records found in the checked collections.</Typography>
              : Object.entries(preflight.linked).filter(([, evidence]) => evidence.count > 0).map(([name, evidence]) =>
                <Typography key={name} variant="body2">• {name}: {evidence.truncated ? "more than 100" : evidence.count} record(s)</Typography>)}
            <Alert severity="warning">{preflight.blockers.length ? "Deletion is blocked until linked records can be safely reconciled." : "Deletion is permanent. Review the event details carefully before confirming."}</Alert>
            {preflight.blockers.map((blocker) => <Typography key={blocker} variant="body2">• {blocker}</Typography>)}
            {preflight.blockers.length === 0 && <TextField fullWidth label="Type the exact event title to confirm" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={deleting} autoComplete="off" /> }
          </>}
        </Stack>
      </DialogContent>
      <DialogActions><Button disabled={deleting} onClick={() => setOpen(false)}>Close</Button><Button color="error" variant="contained" disabled={!preflight || preflight.blockers.length > 0 || confirmation !== preflight.event.title || deleting || loading} onClick={() => void remove()}>{deleting ? "Deleting…" : "Delete event permanently"}</Button></DialogActions>
    </Dialog>
  </>;
}
