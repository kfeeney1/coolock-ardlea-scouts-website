import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DateRangeFields from "../DateRangeFields";
import { useBackDismiss } from "../../hooks/useBackDismiss";
import { createEvent, type EventRecord } from "../../services/eventAdmin";
import { eventCopyInput } from "../../services/scheduleRecordActions";
import { isValidDateRange } from "../../services/dateRangeLogic";
import { applicationErrorMessage } from "../../services/applicationErrors";

export default function EventScheduleCopyDialog({ source, onClose }: { source: EventRecord | null; onClose: () => void }) {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const pendingId = useRef<string | undefined>(undefined);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const cancel = () => { if (inFlight.current) return; if (discard) { setDiscard(false); return; } if (startDate || endDate) setDiscard(true); else onClose(); };
  useBackDismiss(Boolean(source), cancel, "event-schedule-copy");
  useEffect(() => { setStartDate(""); setEndDate(""); setDiscard(false); setError(""); pendingId.current = undefined; }, [source?.id]);
  const save = async () => {
    if (!source || inFlight.current || !isValidDateRange(startDate, endDate, { requireStart: true, requireEnd: true })) return;
    inFlight.current = true; setSaving(true); setError("");
    try {
      const id = await createEvent(eventCopyInput(source, startDate, endDate), pendingId.current, id => { pendingId.current = id; });
      navigate(`/leader/events/${encodeURIComponent(id)}`, { replace: true });
    } catch (failure) { setError(applicationErrorMessage(failure, "Unable to create an event copy. Retry without changing the source.", "EventScheduleCopyDialog")); }
    finally { inFlight.current = false; setSaving(false); }
  };
  if (!source) return null;
  return <>
    <Dialog open onClose={cancel} fullWidth maxWidth="sm" aria-labelledby="event-copy-title">
      <DialogTitle id="event-copy-title">Copy event</DialogTitle>
      <DialogContent dividers><Stack spacing={2}>
        <Typography>{source.title}</Typography>
        <Typography>Create a distinct draft with this event’s details and audience selection. Eligible active members are checked again. Attendance, responses and received consent are not copied.</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <DateRangeFields startDate={startDate} endDate={endDate} startLabel="Copy start date" endLabel="Copy end date" onStartDateChange={setStartDate} onEndDateChange={setEndDate} startRequired endRequired />
      </Stack></DialogContent>
      <DialogActions sx={{ p: 2, flexWrap: "wrap", "& .MuiButton-root": { minHeight: 44 } }}><Button disabled={saving} onClick={cancel}>Cancel copy</Button><Button variant="contained" disabled={saving || !isValidDateRange(startDate, endDate, { requireStart: true, requireEnd: true })} onClick={() => void save()}>{saving ? "Creating copy…" : "Create event copy"}</Button></DialogActions>
    </Dialog>
    <Dialog open={discard} onClose={() => setDiscard(false)} aria-labelledby="event-copy-discard-title"><DialogTitle id="event-copy-discard-title">Discard this event copy?</DialogTitle><DialogContent>No event has been created.</DialogContent><DialogActions><Button onClick={() => setDiscard(false)}>Keep editing</Button><Button color="warning" onClick={onClose}>Discard and cancel</Button></DialogActions></Dialog>
  </>;
}
