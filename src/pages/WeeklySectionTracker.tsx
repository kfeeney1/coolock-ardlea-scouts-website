import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import ProgrammeEquipmentDialog from "../components/admin/ProgrammeEquipmentDialog";
import ProgrammeLibraryPanel from "../components/admin/ProgrammeLibraryPanel";
import WeeklyMeetingHistoryPanel from "../components/admin/WeeklyMeetingHistoryPanel";
import WeeklyBadgeworkPlanEditor from "../components/admin/WeeklyBadgeworkPlanEditor";
import { useSaveOnNavigation } from "../hooks/useSaveOnNavigation";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadAttendanceInsightMembers } from "../services/reporting";
import type { AttendanceInsightMember } from "../services/attendanceInsightsLogic";
import { createWeeklyMeeting, loadWeeklyAccess, loadWeeklyLeaders, loadWeeklyMeetings, newActivityPlan, reopenWeeklyMeeting, updatePastWeeklyMeeting, updateWeeklyMeeting } from "../services/weeklyTracker";
import type { InjurySeverity, WeeklyAccess, WeeklyActivityPlan, WeeklyInjury, WeeklyLeaderOption, WeeklyMeetingRecord } from "../services/weeklyTracker";
import { canEditPastWeeklyMeeting, weeklyMeetingEditMode } from "../services/weeklyMeetingPermissions";
import { displayWeeklyDate, initialWeeklyStep, joinWeeklyLeaders, nonNegativeWeeklyNumber, reconcileOpenWeeklyRoster, splitWeeklyLeaders, sortOpenWeeklyMeetings, sortWeeklyEntries, totalProgrammeDuration, weeklyMeetingHasChanges } from "../services/weeklyTrackerLogic";
import { useWeeklyMeetingShare } from "../hooks/useWeeklyMeetingShare";
import { recordAuditEvent } from "../services/auditLog";
import { badgeworkSourceHref } from "../services/adventureSkillSourceContext";
import { loadEquipmentItems } from "../services/equipment";
import type { EquipmentItem } from "../services/equipment";
import { loadEquipmentLoans } from "../services/equipmentLoans";
import type { EquipmentLoan } from "../services/equipmentLoans";
import { copyEquipmentRequirement } from "../services/equipmentProgramme";
import { effectiveOperationalSections } from "../services/leaderAccessLogic";
import { trySecondaryRefresh } from "../services/secondaryRefresh";

const ALL_LEADERS = "All leaders";
const LEADER_SEPARATOR = " | ";
const STANDARD_MEETING_MINUTES = 90;
const today = new Date().toISOString().slice(0, 10);
type Step = "attendance" | "programme" | "badgework" | "injuries" | "notes";
type NavigationAction = "meetings" | "copy" | "create";

export default function WeeklySectionTracker() {
  const { adminProfile } = useAdminAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const meetingId=searchParams.get("meeting")??"";
  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
  const [access,setAccess]=useState<WeeklyAccess>({scoutingRole:"",canViewAll:false,canEditAll:false,readOnly:false});
  const [members,setMembers]=useState<AttendanceInsightMember[]>([]);
  const [leaders,setLeaders]=useState<WeeklyLeaderOption[]>([]);
  const [records,setRecords]=useState<WeeklyMeetingRecord[]>([]);
  const [equipmentItems,setEquipmentItems]=useState<EquipmentItem[]>([]);
  const [equipmentLoans,setEquipmentLoans]=useState<EquipmentLoan[]>([]);
  const [equipmentOpen,setEquipmentOpen]=useState(false);
  const [selected,setSelected]=useState<WeeklyMeetingRecord|null>(null);
  const [savedSelected,setSavedSelected]=useState<WeeklyMeetingRecord|null>(null);
  const [step,setStep]=useState<Step>("attendance");
  const [copyDate,setCopyDate]=useState(today);
  const [copySection,setCopySection]=useState("");
  const [copySource,setCopySource]=useState<WeeklyMeetingRecord|null>(null);
  const [confirmDiscard,setConfirmCopyDiscard]=useState(false);
  const [injuryMemberId,setInjuryMemberId]=useState("");
  const [injuryConcern,setInjuryConcern]=useState("");
  const [injurySeverity,setInjurySeverity]=useState<InjurySeverity>("minor");
  const [injuryAction,setInjuryAction]=useState("");
  const [injuryParentInformed,setInjuryParentInformed]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const saveInFlight=useRef<Promise<boolean>|null>(null);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const editorTopRef=useRef<HTMLDivElement|null>(null);

  const readOnly=!isAdmin&&access.readOnly;
  const availableSections=useMemo(()=>adminProfile?effectiveOperationalSections(adminProfile.role,adminProfile.sections,adminProfile.appointments):[],[adminProfile]);
  const canEditPast=canEditPastWeeklyMeeting(access.scoutingRole,!!isAdmin);
  const editMode=weeklyMeetingEditMode(selected?.status??"open",access.scoutingRole,!!isAdmin,readOnly);
  const operationalReadOnly=!editMode.canEditOperationalFields;
  const planningReadOnly=!editMode.canEditPlanningFields;
  const selectedSectionLeaders=useMemo(()=>selected?leaders.filter(leader=>leader.organisationSection===selected.section):[],[leaders,selected]);
  const programmeDuration=selected?totalProgrammeDuration(selected.activities,selected.badgeworkPlan):0;
  const {url:whatsappUrl,loading:shareLoading,error:shareError}=useWeeklyMeetingShare(selected);
  const presentMemberIds=selected?.entries.filter(entry=>entry.attendance==="present").map(entry=>entry.memberId)??[];
  const hasUnsavedChanges=weeklyMeetingHasChanges(selected,savedSelected);
  const copyChanged=Boolean(copySource&&(copyDate!==today||copySection!==copySource.section));
  const adventureBadgeworkHref=selected?badgeworkSourceHref({sourceType:"weeklyMeeting",sourceId:selected.id,memberIds:presentMemberIds,returnTo:`/leader/weekly?meeting=${encodeURIComponent(selected.id)}`}):"/leader/badgework";

  const refresh=async(known?:WeeklyAccess,reportFailure=false)=>{
    setLoading(true); setError("");
    try {
      const a=known??await loadWeeklyAccess(); setAccess(a);
      const all=isAdmin||a.canViewAll;
      const [m,r,l,items,loans]=await Promise.all([
        loadAttendanceInsightMembers({isAdmin:Boolean(all),sections:availableSections}),
        loadWeeklyMeetings(adminProfile?.sections??[],!!isAdmin,all),
        loadWeeklyLeaders(availableSections,!!isAdmin,all),
        loadEquipmentItems(),
        loadEquipmentLoans()
      ]);
      setMembers(m.filter(x=>x.status==="active")); setRecords(r); setLeaders(l); setEquipmentItems(items); setEquipmentLoans(loans);
      const requested=r.find(x=>x.id===meetingId);
      if(requested){setSelected(requested);setSavedSelected(requested);setStep(initialWeeklyStep(requested.meetingDate));}
      else if(meetingId&&selected){const fresh=r.find(x=>x.id===selected.id)??selected;setSelected(fresh);setSavedSelected(fresh);}
    } catch(e){setError(applicationErrorMessage(e, "Unable to load weekly meetings for your permitted scope.", "WeeklySectionTracker"));if(reportFailure)throw e;}
    finally{setLoading(false);}
  };
  useEffect(()=>{void refresh();},[availableSections,isAdmin,meetingId]);
  useEffect(()=>{if(!meetingId){setSelected(null);setSavedSelected(null);}},[meetingId]);
  useEffect(()=>{if(!selected||selected.status!=="open")return;const reconciled=reconcileOpenWeeklyRoster(selected.entries,members,selected.section);if(JSON.stringify(reconciled)!==JSON.stringify(selected.entries))setSelected({...selected,entries:reconciled});},[members,selected?.id,selected?.status,selected?.section]);
  useEffect(()=>{if(!copyChanged)return;const warnBeforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",warnBeforeUnload);return()=>window.removeEventListener("beforeunload",warnBeforeUnload);},[copyChanged]);

  const auditWeeklyMeeting=async(record:WeeklyMeetingRecord,action:string,description:string)=>recordAuditEvent({category:"system",action,targetId:record.id,targetLabel:`${record.section} Weekly Meeting · ${record.meetingDate}`,description,section:record.section});
  const patch=(p:Partial<WeeklyMeetingRecord>)=>setSelected(c=>c?{...c,...p}:c);
  const persist=async(next:WeeklyMeetingRecord,message:string,action="weekly-meeting-update"):Promise<boolean>=>{
    if(saveInFlight.current)return saveInFlight.current;
    const editingPast=selected?.id===next.id&&selected.status==="closed";
    if(editingPast&&!editMode.canEditOperationalFields)return false;
    if(!editingPast&&readOnly)return false;
    setSaving(true);setError("");setSuccess("");
    const pending=(async()=>{
      try{
        const{id,...input}=next;
        if(editingPast)await updatePastWeeklyMeeting(id,{entries:sortWeeklyEntries(next.entries),injuries:next.injuries,notes:next.notes});
        else await updateWeeklyMeeting(id,input);
        await auditWeeklyMeeting(next,action,message);
        setSelected(next);setSavedSelected(next);
        const refreshed=await trySecondaryRefresh(()=>refresh(access,true),"weekly meetings");
        setSuccess(refreshed?message:`${message} The meeting was saved, but the screen could not refresh. Reload the page to see the saved record.`);
        return true;
      }catch(e){setError(applicationErrorMessage(e, "Unable to save this meeting.", "WeeklySectionTracker"));return false;}
      finally{setSaving(false);saveInFlight.current=null;}
    })();
    saveInFlight.current=pending;
    return pending;
  };
  const save=async()=>{if(selected&&await persist(selected,"Meeting saved."))requestAnimationFrame(()=>editorTopRef.current?.scrollIntoView({behavior:"smooth",block:"start"}));};
  const closeMeeting=async()=>{if(!selected)return;const closed={...selected,status:"closed" as const};if(!(await persist(closed,"Meeting closed and added to history.","weekly-meeting-close")))return;setSelected(null);setSavedSelected(null);navigate("/leader/weekly",{replace:true});};

  const saveForNavigation=async()=>!!selected&&(!weeklyMeetingHasChanges(selected,savedSelected)||await persist(selected,"Meeting saved."));
  useSaveOnNavigation(hasUnsavedChanges,saveForNavigation,async()=>{if(!selected||readOnly||selected.status==="closed")return false;try{const{id,...input}=selected;await updateWeeklyMeeting(id,input);setSavedSelected(selected);return true;}catch{return false;}});

  const copyMeeting=async()=>{
    if(!copySource||!copyDate)return;
    if(!availableSections.includes(copySection)) { setError("You are not authorised to copy a meeting into that section."); return; }
    const roster=reconcileOpenWeeklyRoster([],members,copySection);
    setSaving(true);
    try{
      const input={section:copySection,meetingDate:copyDate,status:"open" as const,location:copySource.location,theme:copySource.theme,activities:copySource.activities.map(a=>({...a,id:crypto.randomUUID()})),badgeworkPlan:copySource.badgeworkPlan.map(b=>({...b,id:crypto.randomUUID()})),programmeNotes:copySource.programmeNotes,notes:"",entries:roster,injuries:[]};
      const id=await createWeeklyMeeting(input);
      await copyEquipmentRequirement("weeklyMeeting", copySource.id, "weeklyMeeting", id, `${copySection} Weekly Meeting · ${copyDate}`, copySection, copyDate);
      const copied={id,...input}; await auditWeeklyMeeting(copied,"weekly-meeting-copy",`Copied weekly meeting from ${copySource.meetingDate}.`); setSelected(copied); setSavedSelected(copied); setCopySource(null); setStep(initialWeeklyStep(copyDate)); const refreshed=await trySecondaryRefresh(()=>refresh(access,true),"weekly meetings"); setSuccess(`Meeting copied. Planner rows and planned equipment were retained; attendance, completed badgework, injuries, checkout transactions and post-meeting notes were reset.${refreshed?"":" The copy was saved, but the screen could not refresh. Reload the page to see it."}`);
    }catch(e){setError(applicationErrorMessage(e, "Unable to copy this meeting.", "WeeklySectionTracker"));}finally{setSaving(false);}
  };

  const addInjury=()=>{if(!selected||!injuryMemberId||!injuryConcern.trim())return;const member=selected.entries.find(e=>e.memberId===injuryMemberId);if(!member)return;const injury:WeeklyInjury={memberId:member.memberId,memberName:member.memberName,concern:injuryConcern,severity:injurySeverity,actionTaken:injuryAction,parentInformed:injuryParentInformed,recordedAt:new Date().toISOString()};patch({injuries:[...selected.injuries,injury]});setInjuryConcern("");setInjuryAction("");setInjuryParentInformed(false);};
  const updateActivity=(id:string,p:Partial<WeeklyActivityPlan>)=>selected&&patch({activities:selected.activities.map(a=>a.id===id?{...a,...p}:a)});
  const toggleActivityLeader=(activity:WeeklyActivityPlan,name:string,checked:boolean)=>{
    if(name===ALL_LEADERS){updateActivity(activity.id,{leader:checked?ALL_LEADERS:""});return;}
    const current=splitWeeklyLeaders(activity.leader).filter((value)=>value!==ALL_LEADERS);
    updateActivity(activity.id,{leader:joinWeeklyLeaders(checked?[...current,name]:current.filter((value)=>value!==name))});
  };
  const applyNavigationAction=(action:NavigationAction)=>{const current=selected;setSelected(null);setSavedSelected(null);if(action==="copy"&&current){setCopySource(current);setCopyDate(today);setCopySection(current.section);}if(action==="meetings"||action==="copy")navigate("/leader/weekly",{replace:true});else if(action==="create")navigate("/leader/weekly/create");};
  const requestNavigationAction=async(action:NavigationAction)=>{if(hasUnsavedChanges&&selected&&!(await persist(selected,"Meeting saved.")))return;applyNavigationAction(action);};

  const openRecords=sortOpenWeeklyMeetings(records.filter(r=>r.status==="open")),history=records.filter(r=>r.status==="closed");
  const present=selected?.entries.filter(e=>e.attendance==="present").length??0,total=selected?.entries.length??0;

  return <Box sx={{minHeight:"100vh",backgroundColor:"background.default",py:{xs:2,md:5},overflowX:"hidden"}}><Container maxWidth="lg" sx={{px:{xs:1.5,sm:3}}}><LeaderDashboardHeader/><LeaderPageHeader title="Weekly Meetings" description=""/>{error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}{shareError&&<Alert severity="error" sx={{mb:2}}>{shareError}</Alert>}{success&&<Alert severity="success" sx={{mb:2}}>{success}</Alert>}
  {loading?<Box sx={{minHeight:300,display:"grid",placeItems:"center"}}><CircularProgress/></Box>:!selected?<Stack spacing={2}>
    {!readOnly&&<Button component={Link} to="/leader/weekly/create" variant="contained" color="success" size="large" sx={{alignSelf:"flex-start"}}>Create Meeting</Button>}
    <Paper variant="outlined" sx={{p:{xs:1.5,sm:2}}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Open Meeting</Typography>{!openRecords.length?<Alert severity="info">No meetings are currently open.</Alert>:<Stack spacing={1}>{openRecords.map(r=><Button key={r.id} variant="outlined" onClick={()=>{setSelected(r);setSavedSelected(r);setStep(initialWeeklyStep(r.meetingDate));navigate(`?meeting=${r.id}`);}} sx={{justifyContent:"space-between",gap:1,textAlign:"left",minWidth:0}}><span>{displayWeeklyDate(r.meetingDate)} · {r.section}</span><Chip size="small" label="Open"/></Button>)}</Stack>}</Paper>
    <WeeklyMeetingHistoryPanel records={history} sections={availableSections} canEditPast={canEditPast} readOnly={readOnly} onOpen={(record)=>{setSelected(record);setSavedSelected(record);setStep("attendance");}} onReopen={(record)=>{void (async()=>{setSaving(true);setError("");try{await reopenWeeklyMeeting(record.id);await auditWeeklyMeeting(record,"weekly-meeting-reopen","Reopened meeting; previous closure and meeting data retained.");const refreshed=await trySecondaryRefresh(()=>refresh(access,true),"weekly meetings");setSuccess(refreshed?"Meeting reopened.":"Meeting reopened, but the screen could not refresh. Reload the page to see it.");}catch(e){setError(applicationErrorMessage(e, "Unable to reopen this meeting.", "WeeklySectionTracker"));}finally{setSaving(false);}})();}} onCopy={(record)=>{setCopySource(record);setCopyDate(today);setCopySection(record.section);}}/>
    {copySource&&<Paper data-testid="weekly-meeting-copy-form" variant="outlined" sx={{p:{xs:1.5,sm:2}}}><Typography sx={{fontWeight:800,mb:1}}>Copy {displayWeeklyDate(copySource.meetingDate)} · {copySource.section}</Typography><Stack direction={{xs:"column",sm:"row"}} spacing={1}><Button fullWidth variant="outlined" onClick={()=>setCopyDate(today)}>Today</Button><TextField select fullWidth label="Destination section" value={copySection} onChange={e=>setCopySection(e.target.value)}>{availableSections.map(section=><MenuItem key={section} value={section}>{section}</MenuItem>)}</TextField><TextField fullWidth label="Choose date" type="date" value={copyDate} onChange={e=>setCopyDate(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/><Button fullWidth variant="contained" onClick={()=>void copyMeeting()} disabled={saving}>Create Copy</Button><Button fullWidth disabled={saving} onClick={()=>copyChanged?setConfirmCopyDiscard(true):setCopySource(null)}>Cancel</Button></Stack></Paper>}
    <Dialog open={confirmDiscard} onClose={()=>setConfirmCopyDiscard(false)} aria-labelledby="discard-copy-meeting-title" fullWidth maxWidth="sm"><DialogTitle id="discard-copy-meeting-title">Discard this new meeting copy?</DialogTitle><DialogContent><Typography>Your destination or date has changed. Cancel creation and discard these details?</Typography></DialogContent><DialogActions><Button disabled={saving} onClick={()=>setConfirmCopyDiscard(false)}>Keep editing</Button><Button disabled={saving} color="warning" variant="contained" onClick={()=>{setConfirmCopyDiscard(false);setCopySource(null);}}>Discard and cancel</Button></DialogActions></Dialog>
  </Stack>:<Stack spacing={2} sx={{minWidth:0,pb:{xs:"calc(104px + env(safe-area-inset-bottom))",sm:"calc(64px + env(safe-area-inset-bottom))"}}}>
    <Paper ref={editorTopRef} data-testid="weekly-meeting-editor-top" variant="outlined" sx={{p:{xs:1.5,sm:2},minWidth:0,scrollMarginTop:16}}><Stack direction={{xs:"column",md:"row"}} spacing={1} sx={{justifyContent:"space-between",alignItems:{md:"center"}}}><Box sx={{minWidth:0}}><Typography variant="h5" sx={{fontWeight:800,overflowWrap:"anywhere"}}>{selected.section} · {displayWeeklyDate(selected.meetingDate)}</Typography><Chip size="small" label={selected.status==="open"?"Open":"Closed"}/></Box><Stack direction={{xs:"column",sm:"row"}} spacing={1} useFlexGap sx={{flexWrap:"wrap"}}><Button fullWidth onClick={()=>void requestNavigationAction("meetings")}>Back to Weekly Meetings</Button>{!readOnly&&<Button fullWidth variant="contained" color="success" onClick={()=>void requestNavigationAction("create")}>Create Meeting</Button>}<Button fullWidth variant="outlined" color="secondary" onClick={()=>setEquipmentOpen(true)} data-testid="weekly-equipment-button">Equipment</Button><Button fullWidth component="a" href={shareLoading||shareError?undefined:whatsappUrl} target="_blank" rel="noreferrer" variant="outlined" color="success" disabled={shareLoading||Boolean(shareError)} data-testid="weekly-whatsapp-share">{shareLoading?"Preparing share…":"Share in WhatsApp"}</Button>{selected.status==="open"&&!planningReadOnly&&<Button fullWidth variant="outlined" onClick={()=>{setStep("programme");requestAnimationFrame(()=>editorTopRef.current?.scrollIntoView({behavior:"smooth",block:"start"}));}}>Edit Meeting</Button>}{!readOnly&&<Button fullWidth onClick={()=>void requestNavigationAction("copy")}>Copy Meeting</Button>}</Stack></Stack></Paper>
    {selected.status==="closed"&&<Alert severity="info" data-testid="past-meeting-edit-notice">{operationalReadOnly?"This past meeting is read-only. Section Leaders, the Group Leader and Deputy Group Leader can update attendance, medical issues and additional notes.":"Past meeting: only attendance, injuries / medical issues and additional notes can be changed. Programme and completed badgework are locked."}</Alert>}
    <Paper variant="outlined" sx={{p:{xs:1.5,sm:2}}} data-testid="weekly-meeting-summary"><Typography variant="h6" sx={{fontWeight:800,mb:1}}>Meeting summary</Typography><Stack direction="row" spacing={1} useFlexGap sx={{flexWrap:"wrap",mb:1.25}}><Chip size="small" label={`${selected.activities.length} activities / games`}/><Chip size="small" label={`${selected.badgeworkPlan.length} badgework`}/><Chip size="small" label={`${programmeDuration} min planned`}/><Chip size="small" color="success" label={`${present}/${total} present`}/><Chip size="small" label={`${selected.injuries.length} incident${selected.injuries.length===1?"":"s"}`}/></Stack><Typography variant="body2"><strong>Location:</strong> {selected.location||"Not set"}</Typography><Typography variant="body2"><strong>Theme:</strong> {selected.theme||"Not set"}</Typography></Paper>
    <Box data-testid="weekly-step-nav" sx={{display:"grid",gridTemplateColumns:{xs:"repeat(2,minmax(0,1fr))",sm:"repeat(3,minmax(0,1fr))",md:"repeat(5,minmax(0,1fr))"},gap:1}}>{(["attendance","programme","badgework","injuries","notes"] as Step[]).map(s=><Button key={s} fullWidth variant={step===s?"contained":"outlined"} onClick={()=>setStep(s)} sx={{minWidth:0,px:1}}>{s==="badgework"?"Completed Badgework":s==="injuries"?"Injuries / Medical":s[0].toUpperCase()+s.slice(1)}</Button>)}</Box>
    {step==="attendance"&&<Paper variant="outlined" sx={{p:{xs:1.5,sm:2}}}><Stack direction={{xs:"column",sm:"row"}} spacing={1} sx={{justifyContent:"space-between",mb:2}}><Typography variant="h5" sx={{fontWeight:800}}>Attendance</Typography><Chip color="success" label={`${present}/${total} Present`} sx={{alignSelf:{xs:"flex-start",sm:"center"}}}/></Stack>{!operationalReadOnly&&<Button fullWidth variant="outlined" sx={{mb:2}} onClick={()=>patch({entries:selected.entries.map(e=>({...e,attendance:"present"}))})}>Mark all present</Button>}<TableContainer data-testid="attendance-list" sx={{overflowX:"hidden"}}><Table size="small" aria-label="Meeting attendance checklist" sx={{tableLayout:"fixed",width:"100%"}}><TableHead><TableRow><TableCell sx={{width:"50%",px:{xs:0.5,sm:2},py:0.75}}>Member</TableCell><TableCell align="center" sx={{width:"25%",px:{xs:0.5,sm:2},py:0.75}}>Attendance</TableCell><TableCell align="center" sx={{width:"25%",px:{xs:0.5,sm:2},py:0.75}}>Uniform</TableCell></TableRow></TableHead><TableBody>{selected.entries.map(entry=><TableRow key={entry.memberId}><TableCell component="th" scope="row" sx={{overflowWrap:"anywhere",wordBreak:"break-word",px:{xs:0.5,sm:2},py:0.5}}>{entry.memberName}</TableCell><TableCell align="center" sx={{px:{xs:0.5,sm:2},py:0.5}}><Checkbox slotProps={{input:{"aria-label":`Attendance · ${entry.memberName}`}}} disabled={operationalReadOnly} checked={entry.attendance==="present"} sx={{minWidth:44,minHeight:44,p:0.5}} onChange={e=>patch({entries:selected.entries.map(x=>x.memberId===entry.memberId?{...x,attendance:e.target.checked?"present" as const:"absent" as const,...(e.target.checked?{}:{uniform:false})}:x)})}/></TableCell><TableCell align="center" sx={{px:{xs:0.5,sm:2},py:0.5}}><Checkbox slotProps={{input:{"aria-label":`Uniform · ${entry.memberName}`}}} disabled={operationalReadOnly} checked={entry.uniform===true} sx={{minWidth:44,minHeight:44,p:0.5}} onChange={e=>patch({entries:selected.entries.map(x=>x.memberId===entry.memberId?{...x,uniform:e.target.checked,...(e.target.checked?{attendance:"present" as const}:{})}:x)})}/></TableCell></TableRow>)}</TableBody></Table></TableContainer></Paper>}
    {step==="programme"&&<Paper variant="outlined" sx={{p:{xs:1.5,sm:2},minWidth:0}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Programme Planner</Typography><Stack spacing={1.5}><Button variant="outlined" color="secondary" onClick={()=>setEquipmentOpen(true)} data-testid="weekly-programme-equipment-button">Plan / reserve equipment</Button>{selected.status==="open"&&<TextField label="Meeting date" type="date" value={selected.meetingDate} disabled={planningReadOnly} onChange={e=>patch({meetingDate:e.target.value})} slotProps={{inputLabel:{shrink:true}}}/>}<TextField label="Theme" value={selected.theme} disabled={planningReadOnly} onChange={e=>patch({theme:e.target.value})}/><TextField label="Location" value={selected.location} disabled={planningReadOnly} onChange={e=>patch({location:e.target.value})}/><Chip data-testid="programme-duration-total" label={`Planned programme: ${programmeDuration} minutes`} sx={{alignSelf:"flex-start"}}/>{programmeDuration>STANDARD_MEETING_MINUTES&&<Alert severity="warning" data-testid="programme-duration-warning">Planned programme is {programmeDuration} minutes — {programmeDuration-STANDARD_MEETING_MINUTES} minutes longer than the standard 1½-hour meeting.</Alert>}<ProgrammeLibraryPanel section={selected.section} activities={selected.activities} badgework={selected.badgeworkPlan} readOnly={planningReadOnly} onInsertActivity={(item)=>patch({activities:[...selected.activities,item]})} onInsertBadgework={(item)=>patch({badgeworkPlan:[...selected.badgeworkPlan,item]})}/><Typography variant="h6" sx={{fontWeight:800}}>Activities / Games</Typography>{selected.activities.map((activity,index)=>{const parts=splitWeeklyLeaders(activity.leader);const knownNames=new Set(selectedSectionLeaders.map((leader)=>leader.displayName));const customLeaders=parts.filter((value)=>value!==ALL_LEADERS&&!knownNames.has(value));return <Paper key={activity.id} variant="outlined" sx={{p:{xs:1.25,sm:1.5},minWidth:0}} data-testid="activity-plan-row"><Stack spacing={1.25}><Stack direction={{xs:"column",sm:"row"}} spacing={1} sx={{justifyContent:"space-between",alignItems:{sm:"center"}}}><Typography sx={{fontWeight:800}}>Activity / Game {index+1}</Typography>{!planningReadOnly&&<Button size="small" sx={{alignSelf:{xs:"stretch",sm:"auto"}}} onClick={()=>patch({activities:selected.activities.filter(a=>a.id!==activity.id)})}>Remove</Button>}</Stack><TextField label={`Activity ${index+1}`} value={activity.activity} disabled={planningReadOnly} onChange={e=>updateActivity(activity.id,{activity:e.target.value})}/><Box sx={{display:"grid",gridTemplateColumns:{xs:"minmax(0,1fr)",md:"minmax(0,1fr) minmax(0,1fr)"},gap:1.25,minWidth:0}}><Paper variant="outlined" sx={{p:1.25,minWidth:0}}><Typography sx={{fontWeight:700,mb:.5}}>Leaders {index+1}</Typography><FormControlLabel control={<Checkbox disabled={planningReadOnly} checked={activity.leader===ALL_LEADERS} onChange={e=>toggleActivityLeader(activity,ALL_LEADERS,e.target.checked)}/>} label="All leaders"/><Stack>{selectedSectionLeaders.map(leader=><FormControlLabel key={leader.id} control={<Checkbox disabled={planningReadOnly||activity.leader===ALL_LEADERS} checked={parts.includes(leader.displayName)} onChange={e=>toggleActivityLeader(activity,leader.displayName,e.target.checked)}/>} label={`${leader.displayName} · ${leader.scoutingRole}`}/>)}</Stack><TextField fullWidth size="small" label="Other leader(s)" helperText="Separate multiple guest leaders with |" value={customLeaders.join(LEADER_SEPARATOR)} disabled={planningReadOnly||activity.leader===ALL_LEADERS} onChange={e=>{const known=parts.filter((value)=>knownNames.has(value));const custom=e.target.value.split("|").map((value)=>value.trim()).filter(Boolean);updateActivity(activity.id,{leader:joinWeeklyLeaders([...known,...custom])});}}/></Paper><Stack spacing={1.25}><TextField label={`Equipment ${index+1}`} value={activity.equipment} disabled={planningReadOnly} onChange={e=>updateActivity(activity.id,{equipment:e.target.value})}/><TextField label={`Activity duration (minutes) ${index+1}`} type="number" value={activity.durationMinutes||""} disabled={planningReadOnly} onChange={e=>updateActivity(activity.id,{durationMinutes:nonNegativeWeeklyNumber(e.target.value)})} slotProps={{htmlInput:{min:0,max:360}}}/></Stack></Box><TextField multiline minRows={2} label={`Instructions / notes ${index+1}`} value={activity.notes} disabled={planningReadOnly} onChange={e=>updateActivity(activity.id,{notes:e.target.value})}/></Stack></Paper>})}{!planningReadOnly&&<Button variant="outlined" fullWidth onClick={()=>patch({activities:[...selected.activities,newActivityPlan()]})}>Add activity / game</Button>}<Typography variant="h6" sx={{fontWeight:800,pt:1}}>Badgework Plan</Typography>{<WeeklyBadgeworkPlanEditor meeting={selected} sectionLeaders={selectedSectionLeaders} readOnly={planningReadOnly} onPatch={patch}/>}<TextField multiline minRows={2} label="Programme notes" value={selected.programmeNotes} disabled={planningReadOnly} onChange={e=>patch({programmeNotes:e.target.value})}/></Stack></Paper>}
    {step==="badgework"&&<Paper variant="outlined" sx={{p:{xs:1.5,sm:2}}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Completed Badgework</Typography><Typography color="text.secondary" sx={{mb:2}}>Use the Adventure Skills tracker for canonical competency points. Other badge names can still be noted below for the meeting record.</Typography><Button fullWidth variant="contained" color="success" component="a" href={adventureBadgeworkHref} disabled={planningReadOnly||present===0} sx={{mb:2}} data-testid="weekly-adventure-badgework-link">Record Adventure Skills for present children</Button>{planningReadOnly&&<Alert severity="info" sx={{mb:2}}>Adventure Skills cannot be added or changed from a closed meeting. Open the Badgework page directly for later corrections with the appropriate leader permissions.</Alert>}{selected.entries.filter(e=>e.attendance==="present").map(entry=><TextField key={entry.memberId} fullWidth sx={{mb:1}} label={`Other completed badges · ${entry.memberName}`} disabled={planningReadOnly} value={entry.badges.join(", ")} onChange={e=>patch({entries:selected.entries.map(x=>x.memberId===entry.memberId?{...x,badges:e.target.value.split(",").map(b=>b.trim()).filter(Boolean)}:x)})}/>)}{present===0&&<Alert severity="info">Mark attendees present before recording completed badgework.</Alert>}</Paper>}
    {step==="injuries"&&<Paper variant="outlined" sx={{p:{xs:1.5,sm:2}}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Injuries / Medical Issues</Typography>{selected.injuries.map((i,idx)=><Alert key={`${i.recordedAt}-${idx}`} severity={i.severity==="serious"?"error":i.severity==="moderate"?"warning":"info"} sx={{mb:1}}>{i.memberName}: {i.concern} · {i.actionTaken||"No action recorded"} · Parent {i.parentInformed?"informed":"not informed"}</Alert>)}{!operationalReadOnly&&<Stack spacing={1.5}><TextField select label="Member" value={injuryMemberId} onChange={e=>setInjuryMemberId(e.target.value)}>{selected.entries.map(e=><MenuItem key={e.memberId} value={e.memberId}>{e.memberName}</MenuItem>)}</TextField><TextField label="Injury / medical concern" value={injuryConcern} onChange={e=>setInjuryConcern(e.target.value)}/><TextField select label="Severity" value={injurySeverity} onChange={e=>setInjurySeverity(e.target.value as InjurySeverity)}><MenuItem value="minor">Minor</MenuItem><MenuItem value="moderate">Moderate</MenuItem><MenuItem value="serious">Serious</MenuItem></TextField><TextField label="Action taken" value={injuryAction} onChange={e=>setInjuryAction(e.target.value)}/><FormControlLabel control={<Checkbox checked={injuryParentInformed} onChange={e=>setInjuryParentInformed(e.target.checked)}/>} label="Parent informed"/><Button fullWidth variant="outlined" onClick={addInjury}>Add Incident</Button></Stack>}</Paper>}
    {step==="notes"&&<Paper variant="outlined" sx={{p:{xs:1.5,sm:2}}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Additional Notes</Typography><TextField fullWidth multiline minRows={4} label="Additional meeting notes" helperText="Visitors, behaviour, activities completed, equipment issues and other post-meeting notes." value={selected.notes} disabled={operationalReadOnly} onChange={e=>patch({notes:e.target.value})}/></Paper>}
    <ProgrammeEquipmentDialog open={equipmentOpen} sourceType="weeklyMeeting" sourceId={selected.id} sourceLabel={`${selected.section} Weekly Meeting · ${selected.meetingDate}`} section={selected.section} date={selected.meetingDate} items={equipmentItems} loans={equipmentLoans} readOnly={planningReadOnly} onClose={()=>setEquipmentOpen(false)} onChanged={async()=>{setEquipmentLoans(await loadEquipmentLoans());}} />
    {!operationalReadOnly&&<Paper data-testid="weekly-sticky-actions" elevation={3} sx={{position:"sticky",bottom:"calc(8px + env(safe-area-inset-bottom))",p:1.25,zIndex:2,backgroundColor:"background.paper"}}><Stack direction={{xs:"column",sm:"row"}} spacing={1} sx={{justifyContent:"flex-end"}}><Button fullWidth variant="outlined" onClick={()=>void save()} disabled={saving}>Save Meeting</Button>{selected.status==="open"&&<Button fullWidth variant="contained" color="success" onClick={()=>void closeMeeting()} disabled={saving}>Close Meeting</Button>}</Stack></Paper>}
  </Stack>}
  </Container></Box>;
}
