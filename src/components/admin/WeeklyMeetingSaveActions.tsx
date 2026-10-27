import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Typography } from "@mui/material";
import { useRef, useState } from "react";
import type { WeeklyMeetingRecord } from "../../services/weeklyTracker.ts";
type Props = { share?: () => void; stateLabel?: string; selected: WeeklyMeetingRecord; saving: boolean; save: () => void; closeMeeting: () => void | Promise<boolean>; confirmClose?: boolean; review?: () => void; error?: string };
export default function WeeklyMeetingSaveActions({ selected, saving, save, closeMeeting, stateLabel, share, confirmClose = false, review, error }: Props) {
  const [closeOpen, setCloseOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const closing = useRef(false);
  const saveAndClose = async () => {
    if (closing.current || saving) return;
    closing.current = true; setAttempted(true);
    try { if (await closeMeeting() !== false) setCloseOpen(false); } finally { closing.current = false; }
  };
  const requestClose = () => {
    if (review) { review(); return; }
    if (confirmClose) { setAttempted(false); setCloseOpen(true); }
    else void closeMeeting();
  };
  return <><Paper data-testid="weekly-sticky-actions" elevation={3} sx={{ position: "sticky", bottom: "calc(8px + env(safe-area-inset-bottom))", p: 1.25, zIndex: 2, backgroundColor: "background.paper" }}>
    {stateLabel && <Typography role="status" sx={{ mb: 1 }}>{stateLabel}</Typography>}
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "flex-end" }}>
      <Button sx={{ minHeight: 44 }} fullWidth variant="contained" onClick={save} disabled={saving}>Save Meeting</Button>
      {share && <Button sx={{ minHeight: 44 }} fullWidth variant="contained" color="success" onClick={share} disabled={saving}>Share programme</Button>}
      {selected.status === "open" && <Button sx={{ minHeight: 44 }} fullWidth variant="contained" color="success" onClick={requestClose} disabled={saving}>{confirmClose ? review ? "Review & close" : "Save & close" : "Close Meeting"}</Button>}
    </Stack>
  </Paper>
    <Dialog open={closeOpen} onClose={saving ? undefined : () => setCloseOpen(false)} aria-labelledby="meeting-close-title" fullWidth maxWidth="xs">
      <DialogTitle id="meeting-close-title">Save & close meeting?</DialogTitle>
      <DialogContent><Stack spacing={1.5}><Typography>{selected.section} · {selected.meetingDate.split("-").reverse().join("-")}</Typography><Typography>Save the meeting and leader attendance, then add it to history. Programme and completed badgework will be locked. Authorised corrections and deliberate reopening remain available.</Typography>{attempted && error && <Alert severity="error">{error} Your edits are retained. Keep open to review them or try Save & close again.</Alert>}</Stack></DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", "& .MuiButton-root": { minHeight: 44 } }}><Button autoFocus disabled={saving} onClick={() => setCloseOpen(false)}>Keep open</Button><Button variant="contained" color="success" disabled={saving} onClick={() => void saveAndClose()}>{saving ? "Saving…" : "Save & close"}</Button></DialogActions>
    </Dialog>
  </>;
}
