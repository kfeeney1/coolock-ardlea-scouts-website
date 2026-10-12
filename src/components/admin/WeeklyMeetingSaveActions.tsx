import { Button, Paper, Stack } from "@mui/material";
import type { WeeklyMeetingRecord } from "../services/weeklyTracker.ts";
type Props = { selected: WeeklyMeetingRecord; saving: boolean; save: () => void; closeMeeting: () => void; };
export default function WeeklyMeetingSaveActions({ selected, saving, save, closeMeeting }: Props) {
 return <Paper data-testid="weekly-sticky-actions" elevation={3} sx={{position:"sticky",bottom:"calc(8px + env(safe-area-inset-bottom))",p:1.25,zIndex:2,backgroundColor:"background.paper"}}><Stack direction={{xs:"column",sm:"row"}} spacing={1} sx={{justifyContent:"flex-end"}}><Button fullWidth variant="outlined" onClick={save} disabled={saving}>Save Meeting</Button>{selected.status==="open"&&<Button fullWidth variant="contained" color="success" onClick={closeMeeting} disabled={saving}>Close Meeting</Button>}</Stack></Paper>;
}
