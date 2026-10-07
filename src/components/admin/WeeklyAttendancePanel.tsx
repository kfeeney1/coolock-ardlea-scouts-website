import { Button, Checkbox, Chip, FormControlLabel, Paper, Stack, Typography } from "@mui/material";
import type { WeeklyMemberEntry } from "../../services/weeklyTracker";

type Props = {
  entries: WeeklyMemberEntry[];
  readOnly: boolean;
  onChange: (entries: WeeklyMemberEntry[]) => void;
};

export default function WeeklyAttendancePanel({ entries, readOnly, onChange }: Props) {
  const present = entries.filter((entry) => entry.attendance === "present").length;
  const patchEntry = (memberId: string, patch: Partial<WeeklyMemberEntry>) => onChange(entries.map((entry) => entry.memberId === memberId ? { ...entry, ...patch } : entry));
  return <Paper variant="outlined" sx={{p:{xs:1.5,sm:2}}}>
    <Stack direction={{xs:"column",sm:"row"}} spacing={1} sx={{justifyContent:"space-between",mb:2}}><Typography variant="h5" sx={{fontWeight:800}}>Attendance</Typography><Chip color="success" label={`${present}/${entries.length} Present`} sx={{alignSelf:{xs:"flex-start",sm:"center"}}}/></Stack>
    {!readOnly&&<Button fullWidth variant="outlined" sx={{mb:2}} onClick={()=>onChange(entries.map((entry)=>({...entry,attendance:"present"})))}>Mark all present</Button>}
    <Stack data-testid="attendance-list" spacing={1}>{entries.map((entry)=><Paper key={entry.memberId} variant="outlined" sx={{p:1}}><Stack direction={{xs:"column",sm:"row"}} spacing={1} useFlexGap sx={{alignItems:{sm:"center"},justifyContent:"space-between",flexWrap:"wrap"}}><FormControlLabel control={<Checkbox disabled={readOnly} checked={entry.attendance==="present"} onChange={(event)=>patchEntry(entry.memberId,{attendance:event.target.checked?"present":"absent"})}/>} label={entry.memberName}/><FormControlLabel control={<Checkbox disabled={readOnly} checked={entry.uniform===true} onChange={(event)=>patchEntry(entry.memberId,{uniform:event.target.checked})}/>} label={`Uniform · ${entry.memberName}`}/></Stack></Paper>)}</Stack>
  </Paper>;
}
