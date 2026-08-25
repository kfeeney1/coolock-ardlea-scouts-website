import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Container, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadAttendanceInsightMembers } from "../services/reporting";
import type { AttendanceInsightMember } from "../services/attendanceInsightsLogic";
import { createWeeklyMeeting, defaultActivityPlans, defaultBadgeworkPlans, loadWeeklyAccess, loadWeeklyLeaders, loadWeeklyMeetings, newActivityPlan, newBadgeworkPlan, updateWeeklyMeeting } from "../services/weeklyTracker";
import type { InjurySeverity, WeeklyAccess, WeeklyActivityPlan, WeeklyBadgeworkPlan, WeeklyInjury, WeeklyLeaderOption, WeeklyMeetingRecord } from "../services/weeklyTracker";
import { newWeeklyEntry } from "../services/weeklyTrackerLogic";

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
const ALL_LEADERS = "All leaders";
const OTHER_LEADER = "__other__";
const today = new Date().toISOString().slice(0, 10);
type Step = "attendance" | "programme" | "badgework" | "injuries" | "notes";
const displayDate = (value: string) => { const d = new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(d); };

export default function WeeklySectionTracker() {
  const { adminProfile } = useAdminAuth();
  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
  const [access,setAccess]=useState<WeeklyAccess>({scoutingRole:"",canViewAll:false,canEditAll:false,readOnly:false});
  const [members,setMembers]=useState<AttendanceInsightMember[]>([]);
  const [leaders,setLeaders]=useState<WeeklyLeaderOption[]>([]);
  const [records,setRecords]=useState<WeeklyMeetingRecord[]>([]);
  const [selected,setSelected]=useState<WeeklyMeetingRecord|null>(null);
  const [step,setStep]=useState<Step>("attendance");
  const [createDate,setCreateDate]=useState(today);
  const [createSection,setCreateSection]=useState("");
  const [copyDate,setCopyDate]=useState(today);
  const [copySource,setCopySource]=useState<WeeklyMeetingRecord|null>(null);
  const [injuryMemberId,setInjuryMemberId]=useState("");
  const [injuryConcern,setInjuryConcern]=useState("");
  const [injurySeverity,setInjurySeverity]=useState<InjurySeverity>("minor");
  const [injuryAction,setInjuryAction]=useState("");
  const [injuryParentInformed,setInjuryParentInformed]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  const viewAll=isAdmin||access.canViewAll;
  const editableAll=isAdmin||access.canEditAll;
  const readOnly=!isAdmin&&access.readOnly;
  const availableSections=useMemo(()=>viewAll?GROUP_SECTIONS:adminProfile?.sections??[],[adminProfile?.sections,viewAll]);
  const selectedSectionLeaders=useMemo(()=>selected?leaders.filter(leader=>leader.organisationSection===selected.section):[],[leaders,selected]);

  const refresh=async(known?:WeeklyAccess)=>{
    setLoading(true); setError("");
    try {
      const a=known??await loadWeeklyAccess(); setAccess(a);
      const all=isAdmin||a.canViewAll;
      const [m,r,l]=await Promise.all([
        loadAttendanceInsightMembers({isAdmin:Boolean(all),sections:adminProfile?.sections??[]}),
        loadWeeklyMeetings(adminProfile?.sections??[],Boolean(isAdmin),all),
        loadWeeklyLeaders(adminProfile?.sections??[],Boolean(isAdmin),all)
      ]);
      setMembers(m.filter(x=>x.status==="active")); setRecords(r); setLeaders(l);
      if(selected)setSelected(r.find(x=>x.id===selected.id)??selected);
      const sections=all?GROUP_SECTIONS:adminProfile?.sections??[];
      if(!createSection&&sections.length)setCreateSection(sections[0]);
    } catch(e){console.error(e);setError("Unable to load weekly meetings for your permitted scope.");}
    finally{setLoading(false);}
  };
  useEffect(()=>{void refresh();},[adminProfile?.sections,isAdmin]);

  const patch=(p:Partial<WeeklyMeetingRecord>)=>setSelected(c=>c?{...c,...p}:c);
  const persist=async(next:WeeklyMeetingRecord,message:string):Promise<boolean>=>{ if(readOnly)return false; setSaving(true);setError("");setSuccess("");try{const{id,...input}=next;await updateWeeklyMeeting(id,input);setSelected(next);setSuccess(message);await refresh(access);return true;}catch(e){console.error(e);setError("Unable to save this meeting.");return false;}finally{setSaving(false);} };
  const save=async()=>{if(selected&&await persist(selected,"Meeting saved."))setSelected(null);};

  const createMeeting=async()=>{
    setError("");setSuccess("");
    if(!createSection||!createDate)return setError("Choose a section and meeting date.");
    if(records.some(r=>r.section===createSection&&r.meetingDate===createDate))return setError("A meeting already exists for that section and date.");
    const roster=members.filter(m=>m.section===createSection).map(m=>newWeeklyEntry(m.id,m.displayName));
    if(!roster.length)return setError("No active members are available for that section.");
    setSaving(true);
    try{
      const input={section:createSection,meetingDate:createDate,status:"open" as const,location:"",theme:"",activities:defaultActivityPlans(),badgeworkPlan:defaultBadgeworkPlans(),programmeNotes:"",notes:"",entries:roster,injuries:[]};
      const id=await createWeeklyMeeting(input); setSelected({id,...input}); setStep("attendance"); setSuccess("Meeting created with 2 activity/game rows and 1 badgework row."); await refresh(access);
    }catch(e){console.error(e);setError("Unable to create this meeting.");}finally{setSaving(false);}
  };

  const copyMeeting=async()=>{
    if(!copySource||!copyDate)return;
    if(records.some(r=>r.section===copySource.section&&r.meetingDate===copyDate))return setError("A meeting already exists for that section and date.");
    const roster=members.filter(m=>m.section===copySource.section).map(m=>newWeeklyEntry(m.id,m.displayName));
    const fallback=copySource.entries.map(e=>newWeeklyEntry(e.memberId,e.memberName));
    setSaving(true);
    try{
      const input={section:copySource.section,meetingDate:copyDate,status:"open" as const,location:copySource.location,theme:copySource.theme,activities:copySource.activities.map(a=>({...a,id:crypto.randomUUID()})),badgeworkPlan:copySource.badgeworkPlan.map(b=>({...b,id:crypto.randomUUID()})),programmeNotes:copySource.programmeNotes,notes:"",entries:roster.length?roster:fallback,injuries:[]};
      const id=await createWeeklyMeeting(input); setSelected({id,...input}); setCopySource(null); setStep("attendance"); setSuccess("Meeting copied. Planner rows were retained; attendance, completed badgework, injuries and post-meeting notes were reset."); await refresh(access);
    }catch(e){console.error(e);setError("Unable to copy this meeting.");}finally{setSaving(false);}
  };

  const addInjury=()=>{if(!selected||!injuryMemberId||!injuryConcern.trim())return;const member=selected.entries.find(e=>e.memberId===injuryMemberId);if(!member)return;const injury:WeeklyInjury={memberId:member.memberId,memberName:member.memberName,concern:injuryConcern,severity:injurySeverity,actionTaken:injuryAction,parentInformed:injuryParentInformed,recordedAt:new Date().toISOString()};patch({injuries:[...selected.injuries,injury]});setInjuryConcern("");setInjuryAction("");setInjuryParentInformed(false);};
  const updateActivity=(id:string,p:Partial<WeeklyActivityPlan>)=>selected&&patch({activities:selected.activities.map(a=>a.id===id?{...a,...p}:a)});
  const updateBadgework=(id:string,p:Partial<WeeklyBadgeworkPlan>)=>selected&&patch({badgeworkPlan:selected.badgeworkPlan.map(b=>b.id===id?{...b,...p}:b)});

  const openRecords=records.filter(r=>r.status==="open"),history=records.filter(r=>r.status==="closed");
  const present=selected?.entries.filter(e=>e.attendance==="present").length??0,total=selected?.entries.length??0;

  return <Box sx={{minHeight:"100vh",backgroundColor:"background.default",py:{xs:3,md:5}}}><Container maxWidth="lg"><LeaderDashboardHeader/><LeaderPageHeader title="Weekly Meetings" description="Create a meeting, plan the programme, take attendance, record badgework and incidents, then close it into Meeting History."/>{error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}{success&&<Alert severity="success" sx={{mb:2}}>{success}</Alert>}
  {loading?<Box sx={{minHeight:300,display:"grid",placeItems:"center"}}><CircularProgress/></Box>:!selected?<Stack spacing={2}>
    {!readOnly&&<Paper variant="outlined" sx={{p:2}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Create Meeting</Typography><Stack direction={{xs:"column",sm:"row"}} spacing={2}><TextField select label="Section" value={createSection} onChange={e=>setCreateSection(e.target.value)} disabled={!editableAll&&availableSections.length===1} sx={{minWidth:220}}>{availableSections.map(s=><MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField><TextField label="Meeting date" type="date" value={createDate} onChange={e=>setCreateDate(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/><Button variant="contained" color="success" onClick={()=>void createMeeting()} disabled={saving}>Create Meeting</Button></Stack></Paper>}
    <Paper variant="outlined" sx={{p:2}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Open Meeting</Typography>{!openRecords.length?<Alert severity="info">No meetings are currently open.</Alert>:<Stack spacing={1}>{openRecords.map(r=><Button key={r.id} variant="outlined" onClick={()=>{setSelected(r);setStep("attendance");}} sx={{justifyContent:"space-between"}}><span>{displayDate(r.meetingDate)} · {r.section}</span><Chip size="small" label="Open"/></Button>)}</Stack>}</Paper>
    <Paper variant="outlined" sx={{p:2}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Meeting History</Typography>{!history.length?<Alert severity="info">No closed meetings yet.</Alert>:<Stack spacing={1}>{history.map(r=>{const p=r.entries.filter(e=>e.attendance==="present").length;return <Paper key={r.id} variant="outlined" sx={{p:1.5}} data-testid={`meeting-history-${r.id}`}><Stack direction={{xs:"column",sm:"row"}} spacing={1} sx={{justifyContent:"space-between",alignItems:{sm:"center"}}}><Box><Typography sx={{fontWeight:800}}>{displayDate(r.meetingDate)} · {r.section}</Typography><Typography color="text.secondary">{p}/{r.entries.length} Present · Closed · {r.activities.length} activities · {r.badgeworkPlan.length} badgework</Typography></Box><Stack direction="row" spacing={1}><Button onClick={()=>{setSelected(r);setStep("attendance");}}>View / Edit</Button>{!readOnly&&<Button onClick={()=>{setCopySource(r);setCopyDate(today);}}>Copy Meeting</Button>}</Stack></Stack></Paper>})}</Stack>}</Paper>
    {copySource&&<Paper variant="outlined" sx={{p:2}}><Typography sx={{fontWeight:800,mb:1}}>Copy {displayDate(copySource.meetingDate)} · {copySource.section}</Typography><Stack direction={{xs:"column",sm:"row"}} spacing={1}><Button variant="outlined" onClick={()=>setCopyDate(today)}>Today</Button><TextField label="Choose date" type="date" value={copyDate} onChange={e=>setCopyDate(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/><Button variant="contained" onClick={()=>void copyMeeting()} disabled={saving}>Create Copy</Button><Button onClick={()=>setCopySource(null)}>Cancel</Button></Stack></Paper>}
  </Stack>:<Stack spacing={2}>
    <Paper variant="outlined" sx={{p:2}}><Stack direction={{xs:"column",md:"row"}} spacing={1} sx={{justifyContent:"space-between",alignItems:{md:"center"}}}><Box><Typography variant="h5" sx={{fontWeight:800}}>{selected.section} · {displayDate(selected.meetingDate)}</Typography><Chip size="small" label={selected.status==="open"?"Open":"Closed"}/></Box><Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:"wrap"}}><Button onClick={()=>setSelected(null)}>Meetings</Button>{!readOnly&&<Button onClick={()=>{setCopySource(selected);setCopyDate(today);setSelected(null);}}>Copy Meeting</Button>}{!readOnly&&selected.status==="closed"&&<Button variant="outlined" onClick={()=>void persist({...selected,status:"open"},"Meeting reopened.")}>Reopen Meeting</Button>}</Stack></Stack></Paper>
    <Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:"wrap"}}>{(["attendance","programme","badgework","injuries","notes"] as Step[]).map(s=><Button key={s} variant={step===s?"contained":"outlined"} onClick={()=>setStep(s)}>{s==="badgework"?"Badgework":s==="injuries"?"Injuries / Medical":s[0].toUpperCase()+s.slice(1)}</Button>)}</Stack>
    {step==="attendance"&&<Paper variant="outlined" sx={{p:2}}><Stack direction="row" sx={{justifyContent:"space-between",mb:2}}><Typography variant="h5" sx={{fontWeight:800}}>Attendance</Typography><Chip color="success" label={`${present}/${total} Present`}/></Stack>{!readOnly&&<Button variant="outlined" sx={{mb:2}} onClick={()=>patch({entries:selected.entries.map(e=>({...e,attendance:"present"}))})}>Mark all present</Button>}<Stack data-testid="attendance-list">{selected.entries.map(entry=><FormControlLabel key={entry.memberId} control={<Checkbox disabled={readOnly} checked={entry.attendance==="present"} onChange={e=>patch({entries:selected.entries.map(x=>x.memberId===entry.memberId?{...x,attendance:e.target.checked?"present":"absent"}:x)})}/>} label={entry.memberName}/>)}</Stack></Paper>}
    {step==="programme"&&<Paper variant="outlined" sx={{p:2}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Programme Planner</Typography><Stack spacing={1.5}><TextField label="Theme" value={selected.theme} disabled={readOnly} onChange={e=>patch({theme:e.target.value})}/><TextField label="Location" value={selected.location} disabled={readOnly} onChange={e=>patch({location:e.target.value})}/>{selected.activities.map((activity,index)=>{const isKnownLeader=selectedSectionLeaders.some(leader=>leader.displayName===activity.leader);const leaderChoice=activity.leader===ALL_LEADERS?ALL_LEADERS:isKnownLeader?activity.leader:activity.leader?OTHER_LEADER:"";return <Paper key={activity.id} variant="outlined" sx={{p:1.5}} data-testid="activity-plan-row"><Stack spacing={1.25}><Stack direction="row" sx={{justifyContent:"space-between",alignItems:"center"}}><Typography sx={{fontWeight:800}}>Activity / Game {index+1}</Typography>{!readOnly&&<Button size="small" onClick={()=>patch({activities:selected.activities.filter(a=>a.id!==activity.id)})}>Remove</Button>}</Stack><TextField label={`Activity ${index+1}`} value={activity.activity} disabled={readOnly} onChange={e=>updateActivity(activity.id,{activity:e.target.value})}/><Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"1fr 1fr"},gap:1.25}}><Stack spacing={1}><TextField select label={`Leader ${index+1}`} value={leaderChoice} disabled={readOnly} onChange={e=>{const value=e.target.value;if(value===OTHER_LEADER){if(isKnownLeader||activity.leader===ALL_LEADERS)updateActivity(activity.id,{leader:""});}else updateActivity(activity.id,{leader:value});}}><MenuItem value="">Unassigned</MenuItem><MenuItem value={ALL_LEADERS}>All</MenuItem>{selectedSectionLeaders.map(leader=><MenuItem key={leader.id} value={leader.displayName}>{leader.displayName} · {leader.scoutingRole}</MenuItem>)}<MenuItem value={OTHER_LEADER}>Other</MenuItem></TextField>{leaderChoice===OTHER_LEADER&&<TextField label={`Other leader ${index+1}`} value={activity.leader} disabled={readOnly} onChange={e=>updateActivity(activity.id,{leader:e.target.value})}/>}</Stack><TextField label={`Equipment ${index+1}`} value={activity.equipment} disabled={readOnly} onChange={e=>updateActivity(activity.id,{equipment:e.target.value})}/><TextField label={`Start ${index+1}`} type="time" value={activity.startTime} disabled={readOnly} onChange={e=>updateActivity(activity.id,{startTime:e.target.value})} slotProps={{inputLabel:{shrink:true}}}/><TextField label={`Finish ${index+1}`} type="time" value={activity.finishTime} disabled={readOnly} onChange={e=>updateActivity(activity.id,{finishTime:e.target.value})} slotProps={{inputLabel:{shrink:true}}}/></Box><TextField multiline minRows={2} label={`Instructions / notes ${index+1}`} value={activity.notes} disabled={readOnly} onChange={e=>updateActivity(activity.id,{notes:e.target.value})}/></Stack></Paper>})}{!readOnly&&<Button variant="outlined" onClick={()=>patch({activities:[...selected.activities,newActivityPlan()]})}>Add activity / game</Button>}<TextField multiline minRows={2} label="Programme notes" value={selected.programmeNotes} disabled={readOnly} onChange={e=>patch({programmeNotes:e.target.value})}/></Stack></Paper>}
    {step==="badgework"&&<Paper variant="outlined" sx={{p:2}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Badgework</Typography><Stack spacing={1.25} sx={{mb:2}}>{selected.badgeworkPlan.map((item,index)=><Paper key={item.id} variant="outlined" sx={{p:1.5}} data-testid="badgework-plan-row"><Stack spacing={1}><Stack direction="row" sx={{justifyContent:"space-between",alignItems:"center"}}><Typography sx={{fontWeight:800}}>Planned badgework {index+1}</Typography>{!readOnly&&<Button size="small" onClick={()=>patch({badgeworkPlan:selected.badgeworkPlan.filter(b=>b.id!==item.id)})}>Remove</Button>}</Stack><TextField label={`Badgework ${index+1}`} value={item.badge} disabled={readOnly} onChange={e=>updateBadgework(item.id,{badge:e.target.value})}/><TextField multiline minRows={2} label={`Badgework notes ${index+1}`} value={item.notes} disabled={readOnly} onChange={e=>updateBadgework(item.id,{notes:e.target.value})}/></Stack></Paper>)}{!readOnly&&<Button variant="outlined" onClick={()=>patch({badgeworkPlan:[...selected.badgeworkPlan,newBadgeworkPlan()]})}>Add badgework</Button>}</Stack><Typography variant="h6" sx={{mb:1}}>Completed badgework</Typography>{selected.entries.filter(e=>e.attendance==="present").map(entry=><TextField key={entry.memberId} fullWidth sx={{mb:1}} label={`Badges · ${entry.memberName}`} disabled={readOnly} value={entry.badges.join(", ")} onChange={e=>patch({entries:selected.entries.map(x=>x.memberId===entry.memberId?{...x,badges:e.target.value.split(",").map(b=>b.trim()).filter(Boolean)}:x)})}/>)}{present===0&&<Alert severity="info">Mark attendees present before recording completed badgework.</Alert>}</Paper>}
    {step==="injuries"&&<Paper variant="outlined" sx={{p:2}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Injuries / Medical Issues</Typography>{selected.injuries.map((i,idx)=><Alert key={`${i.recordedAt}-${idx}`} severity={i.severity==="serious"?"error":i.severity==="moderate"?"warning":"info"} sx={{mb:1}}>{i.memberName}: {i.concern} · {i.actionTaken||"No action recorded"} · Parent {i.parentInformed?"informed":"not informed"}</Alert>)}{!readOnly&&<Stack spacing={1.5}><TextField select label="Member" value={injuryMemberId} onChange={e=>setInjuryMemberId(e.target.value)}>{selected.entries.map(e=><MenuItem key={e.memberId} value={e.memberId}>{e.memberName}</MenuItem>)}</TextField><TextField label="Injury / medical concern" value={injuryConcern} onChange={e=>setInjuryConcern(e.target.value)}/><TextField select label="Severity" value={injurySeverity} onChange={e=>setInjurySeverity(e.target.value as InjurySeverity)}><MenuItem value="minor">Minor</MenuItem><MenuItem value="moderate">Moderate</MenuItem><MenuItem value="serious">Serious</MenuItem></TextField><TextField label="Action taken" value={injuryAction} onChange={e=>setInjuryAction(e.target.value)}/><FormControlLabel control={<Checkbox checked={injuryParentInformed} onChange={e=>setInjuryParentInformed(e.target.checked)}/>} label="Parent informed"/><Button variant="outlined" onClick={addInjury}>Add Incident</Button></Stack>}</Paper>}
    {step==="notes"&&<Paper variant="outlined" sx={{p:2}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Additional Notes</Typography><TextField fullWidth multiline minRows={4} label="Additional meeting notes" helperText="Visitors, behaviour, activities completed, equipment issues and other post-meeting notes." value={selected.notes} disabled={readOnly} onChange={e=>patch({notes:e.target.value})}/></Paper>}
    {!readOnly&&<Paper elevation={3} sx={{position:"sticky",bottom:8,p:1.5}}><Stack direction={{xs:"column",sm:"row"}} spacing={1} sx={{justifyContent:"flex-end"}}><Button variant="outlined" onClick={()=>void save()} disabled={saving}>Save Meeting</Button>{selected.status==="open"&&<Button variant="contained" color="success" onClick={()=>void persist({...selected,status:"closed"},"Meeting closed and added to history.")} disabled={saving}>Close Meeting</Button>}</Stack></Paper>}
  </Stack>}</Container></Box>;
}