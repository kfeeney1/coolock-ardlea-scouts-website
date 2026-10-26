import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from "@mui/material";
import { useState } from "react";
import type { WeeklyMeetingRecord } from "../../services/weeklyTracker";
export default function MeetingRunProgrammeReference({ selected }: { selected: WeeklyMeetingRecord }) {
  const [open, setOpen] = useState(false);
  return <><Button variant="outlined" onClick={() => setOpen(true)} sx={{ minHeight: 44, alignSelf: "flex-start" }}>View programme</Button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="run-programme-title">
      <DialogTitle id="run-programme-title">Programme reference</DialogTitle><DialogContent sx={{ overflowWrap: "anywhere" }}><Stack spacing={1.5}>
        <Typography color="text.secondary">Current meeting draft. Close this reference to return to your attendance position.</Typography>
        {!selected.activities.length && !selected.badgeworkPlan.length && <Alert severity="info">No programme items planned.</Alert>}
        {selected.activities.map(item => <Stack key={item.id} spacing={.5}><Typography component="h3" variant="subtitle1" sx={{ fontWeight: 800 }}>{item.activity || "Untitled activity"} · {item.durationMinutes} min</Typography><Typography>{item.leader || "No leaders selected"}</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{item.notes}</Typography><Typography>Equipment: {item.equipment || "None listed"}</Typography><Divider /></Stack>)}
        {selected.badgeworkPlan.map(item => <Stack key={item.id}><Typography component="h3" variant="subtitle1" sx={{ fontWeight: 800 }}>{item.badge || "Badgework"} · {item.durationMinutes} min</Typography><Typography>{item.leader}</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{item.notes}</Typography><Typography>Equipment: {item.equipment || "None listed"}</Typography></Stack>)}
        {selected.programmeNotes && <Typography sx={{ whiteSpace: "pre-wrap" }}>{selected.programmeNotes}</Typography>}
      </Stack></DialogContent><DialogActions><Button autoFocus sx={{ minHeight: 44 }} onClick={() => setOpen(false)}>Back to attendance</Button></DialogActions>
    </Dialog></>;
}
