import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import type { WeeklyMeetingRecord } from "../../services/weeklyTracker";
type Props = { selected: WeeklyMeetingRecord; readOnly: boolean; busy: boolean; onOpen?: () => void; patch: (change: Partial<WeeklyMeetingRecord>) => void };
export default function MeetingReviewBadgework({ selected, readOnly, busy, onOpen, patch }: Props) {
  const present = selected.entries.filter(entry => entry.attendance === "present");
  return <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}><Stack spacing={1.5}>
    <Typography component="h3" variant="h5" sx={{ fontWeight: 800 }}>Adventure Skills</Typography>
    <Typography color="text.secondary">Record competency points in the canonical Adventure Skills tracker for eligible present members. The meeting is saved before the tracker opens; return to this meeting from the tracker.</Typography>
    <Button variant="contained" color="success" disabled={readOnly || busy || !present.length} onClick={onOpen} sx={{ minHeight: 44, whiteSpace: "normal" }} data-testid="weekly-adventure-badgework-link">Record Adventure Skills for present children</Button>
    {readOnly && <Alert severity="info">Meeting badgework is locked. Closed meetings cannot add or change Adventure Skills here. Later corrections use the Badgework page directly with the appropriate leader permissions.</Alert>}
    {!present.length && <Alert severity="info">Mark attendees present before recording completed badgework.</Alert>}
    <Typography component="h3" variant="h6" sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>Other badges completed — meeting notes only</Typography>
    <Typography color="text.secondary">These comma-separated badge names are notes on this meeting only. They do not update the canonical Adventure Skills tracker.</Typography>
    {present.map(entry => <Stack key={entry.memberId} spacing={.5}><Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{entry.memberName}</Typography><TextField multiline label="Other completed badges" slotProps={{ htmlInput: { "aria-label": `Other completed badges · ${entry.memberName}` } }} value={entry.badges.join(", ")} disabled={readOnly || busy} onChange={event => patch({ entries: selected.entries.map(item => item.memberId === entry.memberId ? { ...item, badges: event.target.value.split(",").map(name => name.trim()).filter(Boolean) } : item) })} fullWidth /></Stack>)}
  </Stack></Paper>;
}
