import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { displayWeeklyDate } from "../services/weeklyTrackerLogic.ts";
import type { WeeklyMeetingRecord } from "../services/weeklyTracker.ts";

type Props = { source: WeeklyMeetingRecord; copyDate: string; copySection: string; today: string; availableSections: string[]; attendancePreview: WeeklyMeetingRecord["entries"]; copyChanged: boolean; saving: boolean; confirmDiscard: boolean; setCopyDate: (date: string) => void; setCopySection: (section: string) => void; setConfirmDiscard: (open: boolean) => void; cancelCopy: () => void; copyMeeting: () => void; };
export default function WeeklyMeetingCopyDialog(props: Props) {
 const { source, copyDate, copySection, today, availableSections, attendancePreview, copyChanged, saving, confirmDiscard, setCopyDate, setCopySection, setConfirmDiscard, cancelCopy, copyMeeting } = props;
 return <>
  {source&&<Dialog open onClose={()=>copyChanged?setConfirmDiscard(true):cancelCopy()} aria-labelledby="copy-weekly-meeting-title" aria-describedby="copy-weekly-meeting-description" fullWidth maxWidth="sm" scroll="paper" data-testid="weekly-meeting-copy-dialog">
    <DialogTitle id="copy-weekly-meeting-title">Copy {displayWeeklyDate(source.meetingDate)} · {source.section}</DialogTitle>
    <DialogContent dividers><Typography id="copy-weekly-meeting-description" color="text.secondary" sx={{mb:2}}>Create a new meeting from this plan. The source meeting and its attendance history stay unchanged.</Typography><Stack spacing={1.5}>
      <Button variant="outlined" onClick={()=>setCopyDate(today)}>Today</Button>
      <TextField select autoFocus fullWidth label="Destination section" value={copySection} onChange={e=>setCopySection(e.target.value)}>{availableSections.map(section=><MenuItem key={section} value={section}>{section}</MenuItem>)}</TextField>
      <TextField fullWidth label="Choose date" type="date" value={copyDate} onChange={e=>setCopyDate(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/>
      <Paper data-testid="copy-attendance-preview" variant="outlined" sx={{p:1.5,maxHeight:180,overflowY:"auto"}}><Typography variant="subtitle2" sx={{fontWeight:800}}>Attendance preview · {copySection||"Select a destination section"} ({attendancePreview.length} members)</Typography><Typography variant="body2" color="text.secondary">Attendance starts unrecorded. Source attendance, incidents and completed badgework are not copied.</Typography><Stack component="ul" spacing={0} sx={{pl:2.5,my:1}}>{attendancePreview.map(entry=><Typography component="li" variant="body2" key={entry.memberId}>{entry.memberName}</Typography>)}</Stack></Paper>
    </Stack></DialogContent>
    <DialogActions sx={{p:2,flexDirection:{xs:"column-reverse",sm:"row"},alignItems:{xs:"stretch",sm:"center"}}}><Button disabled={saving} onClick={()=>copyChanged?setConfirmDiscard(true):cancelCopy()}>Cancel copy</Button><Button variant="contained" onClick={()=>void copyMeeting()} disabled={saving||!copyDate}>Create Copy</Button></DialogActions>
  </Dialog>}
  <Dialog open={confirmDiscard} onClose={()=>setConfirmDiscard(false)} aria-labelledby="discard-copy-meeting-title" fullWidth maxWidth="sm"><DialogTitle id="discard-copy-meeting-title">Discard this new meeting copy?</DialogTitle><DialogContent><Typography>Your destination or date has changed. Cancel creation and discard these details?</Typography></DialogContent><DialogActions><Button disabled={saving} onClick={()=>setConfirmDiscard(false)}>Keep editing</Button><Button disabled={saving} color="warning" variant="contained" onClick={cancelCopy}>Discard and cancel</Button></DialogActions></Dialog>
 </>;
}
