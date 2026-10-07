import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import type { WeeklyMeetingRecord } from "../../services/weeklyTracker";

export type WeeklyMeetingStep = "attendance" | "programme" | "badgework" | "injuries" | "notes";

type Props = { meeting: WeeklyMeetingRecord; programmeDuration: number; present: number; step: WeeklyMeetingStep; onStep: (step: WeeklyMeetingStep) => void };

export default function WeeklyMeetingSummary({ meeting, programmeDuration, present, step, onStep }: Props) {
  const steps: WeeklyMeetingStep[] = ["attendance","programme","badgework","injuries","notes"];
  return <>
    <Paper variant="outlined" sx={{p:{xs:1.5,sm:2}}} data-testid="weekly-meeting-summary"><Typography variant="h6" sx={{fontWeight:800,mb:1}}>Meeting summary</Typography><Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:"wrap",mb:1.25}}><Chip size="small" label={`${meeting.activities.length} activities / games`}/><Chip size="small" label={`${meeting.badgeworkPlan.length} badgework`}/><Chip size="small" label={`${programmeDuration} min planned`}/><Chip size="small" color="success" label={`${present}/${meeting.entries.length} present`}/><Chip size="small" label={`${meeting.injuries.length} incident${meeting.injuries.length===1?"":"s"}`}/></Stack><Typography variant="body2"><strong>Location:</strong> {meeting.location||"Not set"}</Typography><Typography variant="body2"><strong>Theme:</strong> {meeting.theme||"Not set"}</Typography></Paper>
    <Box data-testid="weekly-step-nav" sx={{display:"grid",gridTemplateColumns:{xs:"repeat(2,minmax(0,1fr))",sm:"repeat(3,minmax(0,1fr))",md:"repeat(5,minmax(0,1fr))"},gap:1}}>{steps.map((value)=><Button key={value} fullWidth variant={step===value?"contained":"outlined"} onClick={()=>onStep(value)} sx={{minWidth:0,px:1}}>{value==="badgework"?"Completed Badgework":value==="injuries"?"Injuries / Medical":value[0].toUpperCase()+value.slice(1)}</Button>)}</Box>
  </>;
}
