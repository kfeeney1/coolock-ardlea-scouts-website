import MeetingRunIncidents from "./MeetingRunIncidents";
import { Alert, Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import type { InjurySeverity, WeeklyInjury, WeeklyMeetingRecord } from "../../services/weeklyTracker.ts";

type Step = "attendance" | "programme" | "badgework" | "injuries" | "notes";
export type WeeklyMeetingDetailsProps = { step: Step; redesigned?: boolean;
 selected: WeeklyMeetingRecord; present: number; planningReadOnly: boolean; operationalReadOnly: boolean; adventureBadgeworkHref: string;
 injuryMemberId: string; setInjuryMemberId: (id: string) => void; injuryConcern: string; setInjuryConcern: (value: string) => void;
 injurySeverity: InjurySeverity; setInjurySeverity: (value: InjurySeverity) => void; injuryAction: string; setInjuryAction: (value: string) => void;
 injuryParentInformed: boolean; setInjuryParentInformed: (value: boolean) => void; patch: (change: Partial<WeeklyMeetingRecord>) => void;
};
export default function WeeklyMeetingDetailsPanels(props: WeeklyMeetingDetailsProps) {
 const { step, selected, present, planningReadOnly, operationalReadOnly, adventureBadgeworkHref, injuryMemberId, setInjuryMemberId, injuryConcern, setInjuryConcern, injurySeverity, setInjurySeverity, injuryAction, setInjuryAction, injuryParentInformed, setInjuryParentInformed, patch } = props;
 const addInjury = () => {
   if (!selected || !injuryMemberId || !injuryConcern.trim()) return;
   const member = selected.entries.find(entry => entry.memberId === injuryMemberId);
   if (!member) return;
   const injury: WeeklyInjury = { memberId: member.memberId, memberName: member.memberName, concern: injuryConcern, severity: injurySeverity, actionTaken: injuryAction, parentInformed: injuryParentInformed, recordedAt: new Date().toISOString() };
   patch({ injuries: [...selected.injuries, injury] });
   setInjuryConcern("");
   setInjuryAction("");
   setInjuryParentInformed(false);
 };
 return <>
{step==="badgework"&&(<Paper variant="outlined" sx={{p:{xs:1.5,sm:2}}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Completed Badgework</Typography><Typography color="text.secondary" sx={{mb:2}}>Use the Adventure Skills tracker for canonical competency points. Other badge names can still be noted below for the meeting record.</Typography><Button fullWidth variant="contained" color="success" component="a" href={adventureBadgeworkHref} disabled={planningReadOnly||present===0} sx={{mb:2}} data-testid="weekly-adventure-badgework-link">Record Adventure Skills for present children</Button>{planningReadOnly&&<Alert severity="info" sx={{mb:2}}>Adventure Skills cannot be added or changed from a closed meeting. Open the Badgework page directly for later corrections with the appropriate leader permissions.</Alert>}{selected.entries.filter(e=>e.attendance==="present").map(entry=><TextField key={entry.memberId} fullWidth sx={{mb:1}} label={`Other completed badges · ${entry.memberName}`} disabled={planningReadOnly} value={entry.badges.join(", ")} onChange={e=>patch({entries:selected.entries.map(x=>x.memberId===entry.memberId?{...x,badges:e.target.value.split(",").map(b=>b.trim()).filter(Boolean)}:x)})}/>)}{present===0&&<Alert severity="info">Mark attendees present before recording completed badgework.</Alert>}</Paper>)}
{step==="injuries"&&(props.redesigned?<MeetingRunIncidents {...props}/>:<Paper variant="outlined" sx={{p:{xs:1.5,sm:2}}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Injuries / Medical Issues</Typography>{selected.injuries.map((i,idx)=><Alert key={`${i.recordedAt}-${idx}`} severity={i.severity==="serious"?"error":i.severity==="moderate"?"warning":"info"} sx={{mb:1}}>{i.memberName}: {i.concern} · {i.actionTaken||"No action recorded"} · Parent {i.parentInformed?"informed":"not informed"}</Alert>)}{!operationalReadOnly&&<Stack spacing={1.5}><TextField select label="Member" value={injuryMemberId} onChange={e=>setInjuryMemberId(e.target.value)}>{selected.entries.map(e=><MenuItem key={e.memberId} value={e.memberId}>{e.memberName}</MenuItem>)}</TextField><TextField label="Injury / medical concern" value={injuryConcern} onChange={e=>setInjuryConcern(e.target.value)}/><TextField select label="Severity" value={injurySeverity} onChange={e=>setInjurySeverity(e.target.value as InjurySeverity)}><MenuItem value="minor">Minor</MenuItem><MenuItem value="moderate">Moderate</MenuItem><MenuItem value="serious">Serious</MenuItem></TextField><TextField label="Action taken" value={injuryAction} onChange={e=>setInjuryAction(e.target.value)}/><FormControlLabel control={<Checkbox checked={injuryParentInformed} onChange={e=>setInjuryParentInformed(e.target.checked)}/>} label="Parent informed"/><Button fullWidth variant="outlined" onClick={addInjury}>Add Incident</Button></Stack>}</Paper>)}
{step==="notes"&&(<Paper variant="outlined" sx={{p:{xs:1.5,sm:2}}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Additional Notes</Typography><TextField fullWidth multiline minRows={4} label="Additional meeting notes" helperText="Visitors, behaviour, activities completed, equipment issues and other post-meeting notes." value={selected.notes} disabled={operationalReadOnly} onChange={e=>patch({notes:e.target.value})}/></Paper>)}
 </>;
}
