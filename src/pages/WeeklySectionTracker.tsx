import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Button, Chip, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import ProgrammeEquipmentDialog from "../components/admin/ProgrammeEquipmentDialog";
import WeeklyMeetingHistoryPanel from "../components/admin/WeeklyMeetingHistoryPanel";
import WeeklyMeetingAttendancePanel from "../components/admin/WeeklyMeetingAttendancePanel";
import WeeklyProgrammePlanner from "../components/admin/WeeklyProgrammePlanner";
import WeeklyMeetingDetailsPanels from "../components/admin/WeeklyMeetingDetailsPanels";
import WeeklyMeetingEditorControls from "../components/admin/WeeklyMeetingEditorControls";
import WeeklyMeetingSaveActions from "../components/admin/WeeklyMeetingSaveActions";
import { useSaveOnNavigation } from "../hooks/useSaveOnNavigation";
import { useWeeklyLeaderAttendance } from "../hooks/useWeeklyLeaderAttendance";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadAttendanceInsightMembers } from "../services/reporting";
import type { AttendanceInsightMember } from "../services/attendanceInsightsLogic";
import { loadWeeklyAccess, loadWeeklyMeetings, reopenWeeklyMeeting, updatePastWeeklyMeeting, updateWeeklyMeeting } from "../services/weeklyTracker";
import type { InjurySeverity, WeeklyAccess, WeeklyLeaderOption, WeeklyMeetingRecord } from "../services/weeklyTracker";
import { canEditPastWeeklyMeeting, weeklyMeetingEditMode } from "../services/weeklyMeetingPermissions";
import { displayWeeklyDate, initialWeeklyStep, reconcileOpenWeeklyRoster, sortOpenWeeklyMeetings, sortWeeklyEntries, totalProgrammeDuration, weeklyMeetingHasChanges } from "../services/weeklyTrackerLogic";
import { useWeeklyMeetingShare } from "../hooks/useWeeklyMeetingShare";
import { recordAuditEvent } from "../services/auditLog";
import { badgeworkSourceHref } from "../services/adventureSkillSourceContext";
import { loadEquipmentItems } from "../services/equipment";
import type { EquipmentItem } from "../services/equipment";
import { loadEquipmentLoans } from "../services/equipmentLoans";
import type { EquipmentLoan } from "../services/equipmentLoans";
import { effectiveOperationalSections } from "../services/leaderAccessLogic";
import { trySecondaryRefresh } from "../services/secondaryRefresh";
import { loadLeaderAttendanceOptions } from "../services/leaderAttendance";

const today = new Date().toISOString().slice(0, 10);
type Step = "attendance" | "programme" | "badgework" | "injuries" | "notes";
type NavigationAction = "meetings" | "copy" | "create";

export default function WeeklySectionTracker() {
  const { adminProfile } = useAdminAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const meetingId=searchParams.get("meeting")??"";
  const meetingIdRef=useRef(meetingId);
  meetingIdRef.current=meetingId;
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
  const [injuryMemberId,setInjuryMemberId]=useState("");
  const [injuryConcern,setInjuryConcern]=useState("");
  const [injurySeverity,setInjurySeverity]=useState<InjurySeverity>("minor");
  const [injuryAction,setInjuryAction]=useState("");
  const [injuryParentInformed,setInjuryParentInformed]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const saveInFlight=useRef<Promise<boolean>|null>(null);
  const refreshSequence=useRef(0);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const editorTopRef=useRef<HTMLDivElement|null>(null);
  const { entries: leaderAttendance, setEntries: setLeaderAttendance, loading: leaderAttendanceLoading, hasChanges: leaderAttendanceChanged, save: saveActivityLeaderAttendance }=useWeeklyLeaderAttendance(selected?.id??"",selected?.section??"",leaders,setError);

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
  const hasUnsavedChanges=weeklyMeetingHasChanges(selected,savedSelected)||leaderAttendanceChanged;
  const adventureBadgeworkHref=selected?badgeworkSourceHref({sourceType:"weeklyMeeting",sourceId:selected.id,memberIds:presentMemberIds,returnTo:`/leader/weekly?meeting=${encodeURIComponent(selected.id)}`}):"/leader/badgework";

  const refresh=async(known?:WeeklyAccess,reportFailure=false)=>{
    const sequence=++refreshSequence.current;
    setLoading(true); setError("");
    try {
      const a=known??await loadWeeklyAccess();
      const all=isAdmin||a.canViewAll;
      const [m,r,l,items,loans]=await Promise.all([
        loadAttendanceInsightMembers({isAdmin:Boolean(all),sections:availableSections}),
        loadWeeklyMeetings(adminProfile?.sections??[],!!isAdmin,all),
        loadLeaderAttendanceOptions(["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"],true),
        loadEquipmentItems(),
        loadEquipmentLoans()
      ]);
      if(sequence!==refreshSequence.current||meetingIdRef.current!==meetingId)return;
      setAccess(a);
      setMembers(m.filter(x=>x.status==="active")); setRecords(r); setLeaders(l); setEquipmentItems(items); setEquipmentLoans(loans);
      const requested=r.find(x=>x.id===meetingId);
      if(requested){setSelected(requested);setSavedSelected(requested);setStep(requested.status==="closed"?"attendance":initialWeeklyStep(requested.meetingDate));}
      else if(meetingId&&selected){const fresh=r.find(x=>x.id===selected.id)??selected;setSelected(fresh);setSavedSelected(fresh);}
    } catch(e){if(sequence===refreshSequence.current)setError(applicationErrorMessage(e, "Unable to load weekly meetings for your permitted scope.", "WeeklySectionTracker"));if(reportFailure)throw e;}
    finally{if(sequence===refreshSequence.current)setLoading(false);}
  };
  useEffect(()=>{void refresh();},[availableSections,isAdmin,meetingId]);
  useEffect(()=>{if(!meetingId){setSelected(null);setSavedSelected(null);}},[meetingId]);
  useEffect(()=>{if(!selected||selected.status!=="open")return;const reconciled=reconcileOpenWeeklyRoster(selected.entries,members,selected.section);if(JSON.stringify(reconciled)!==JSON.stringify(selected.entries))setSelected({...selected,entries:reconciled});},[members,selected?.id,selected?.status,selected?.section]);

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
        await saveActivityLeaderAttendance(id);
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

  const saveForNavigation=async()=>!!selected&&(!hasUnsavedChanges||await persist(selected,"Meeting saved."));
  useSaveOnNavigation(hasUnsavedChanges,saveForNavigation,async()=>{if(!selected||readOnly||selected.status==="closed")return false;try{const{id,...input}=selected;await updateWeeklyMeeting(id,input);await saveActivityLeaderAttendance(id);setSavedSelected(selected);return true;}catch{return false;}});

  const applyNavigationAction=(action:NavigationAction)=>{const current=selected;if(action==="copy"&&current){navigate(`/leader/weekly/copy/${encodeURIComponent(current.id)}`);return;}setSelected(null);setSavedSelected(null);if(action==="meetings")navigate("/leader/weekly",{replace:true});else if(action==="create")navigate("/leader/weekly/create");};
  const requestNavigationAction=async(action:NavigationAction)=>{if(hasUnsavedChanges&&selected&&!(await persist(selected,"Meeting saved.")))return;applyNavigationAction(action);};

  const openRecords=sortOpenWeeklyMeetings(records.filter(r=>r.status==="open")),history=records.filter(r=>r.status==="closed");
  const present=selected?.entries.filter(e=>e.attendance==="present").length??0,total=selected?.entries.length??0;

  return <Box sx={{minHeight:"100vh",backgroundColor:"background.default",py:{xs:2,md:5},overflowX:"hidden"}}><Container maxWidth="lg" sx={{px:{xs:1.5,sm:3}}}><LeaderDashboardHeader/><LeaderPageHeader title="Weekly Meetings" description=""/>{error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}{shareError&&<Alert severity="error" sx={{mb:2}}>{shareError}</Alert>}{success&&<Alert severity="success" sx={{mb:2}}>{success}</Alert>}
  {loading?<Box sx={{minHeight:300,display:"grid",placeItems:"center"}}><CircularProgress/></Box>:!selected?<Stack spacing={2}>
    {!readOnly&&<Button component={Link} to="/leader/weekly/create" variant="contained" color="success" size="large" sx={{alignSelf:"flex-start"}}>Create Meeting</Button>}
    <Paper variant="outlined" sx={{p:{xs:1.5,sm:2}}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Open Meeting</Typography>{!openRecords.length?<Alert severity="info">No meetings are currently open.</Alert>:<Stack spacing={1}>{openRecords.map(r=><Button key={r.id} variant="contained" onClick={()=>{setSelected(r);setSavedSelected(r);setStep(initialWeeklyStep(r.meetingDate));navigate(`?meeting=${r.id}`);}} sx={{justifyContent:"space-between",gap:1,textAlign:"left",minWidth:0}}><span>{displayWeeklyDate(r.meetingDate)} · {r.section}</span><Chip size="small" label="Open"/></Button>)}</Stack>}</Paper>
    <WeeklyMeetingHistoryPanel records={history} sections={availableSections} canEditPast={canEditPast} readOnly={readOnly} onReopen={(record)=>{void (async()=>{setSaving(true);setError("");try{await reopenWeeklyMeeting(record.id);await auditWeeklyMeeting(record,"weekly-meeting-reopen","Reopened meeting; previous closure and meeting data retained.");const refreshed=await trySecondaryRefresh(()=>refresh(access,true),"weekly meetings");setSuccess(refreshed?"Meeting reopened.":"Meeting reopened, but the screen could not refresh. Reload the page to see it.");const reopened={...record,status:"open" as const};setSelected(reopened);setSavedSelected(reopened);setStep(initialWeeklyStep(reopened.meetingDate));navigate(`/leader/weekly?meeting=${encodeURIComponent(record.id)}`);}catch(e){setError(applicationErrorMessage(e, "Unable to reopen this meeting.", "WeeklySectionTracker"));}finally{setSaving(false);}})();}} />


  </Stack>:<Stack spacing={2} sx={{minWidth:0,pb:{xs:"calc(104px + env(safe-area-inset-bottom))",sm:"calc(64px + env(safe-area-inset-bottom))"}}}>
    <WeeklyMeetingEditorControls selected={selected} step={step} setStep={setStep} programmeDuration={programmeDuration} present={present} total={total} operationalReadOnly={operationalReadOnly} planningReadOnly={planningReadOnly} readOnly={readOnly} shareLoading={shareLoading} shareError={shareError??""} whatsappUrl={whatsappUrl} editorTopRef={editorTopRef} requestNavigationAction={requestNavigationAction} setEquipmentOpen={setEquipmentOpen}/>
    {step==="attendance"&&<WeeklyMeetingAttendancePanel entries={selected.entries} present={present} total={total} readOnly={operationalReadOnly} onEntriesChange={(entries)=>patch({entries})} leaders={leaders} leaderAttendance={leaderAttendance} onLeaderAttendanceChange={setLeaderAttendance} leaderAttendanceLoading={leaderAttendanceLoading}/>}
    {step==="programme"&&<WeeklyProgrammePlanner selected={selected} selectedSectionLeaders={selectedSectionLeaders} planningReadOnly={planningReadOnly} programmeDuration={programmeDuration} setEquipmentOpen={setEquipmentOpen} patch={patch}/>}
    <WeeklyMeetingDetailsPanels step={step} selected={selected} present={present} planningReadOnly={planningReadOnly} operationalReadOnly={operationalReadOnly} adventureBadgeworkHref={adventureBadgeworkHref} injuryMemberId={injuryMemberId} setInjuryMemberId={setInjuryMemberId} injuryConcern={injuryConcern} setInjuryConcern={setInjuryConcern} injurySeverity={injurySeverity} setInjurySeverity={setInjurySeverity} injuryAction={injuryAction} setInjuryAction={setInjuryAction} injuryParentInformed={injuryParentInformed} setInjuryParentInformed={setInjuryParentInformed} patch={patch}/>
    <ProgrammeEquipmentDialog open={equipmentOpen} sourceType="weeklyMeeting" sourceId={selected.id} sourceLabel={`${selected.section} Weekly Meeting · ${selected.meetingDate}`} section={selected.section} date={selected.meetingDate} items={equipmentItems} loans={equipmentLoans} readOnly={planningReadOnly} onClose={()=>setEquipmentOpen(false)} onChanged={async()=>{setEquipmentLoans(await loadEquipmentLoans());}} />
    {!operationalReadOnly&&<WeeklyMeetingSaveActions selected={selected} saving={saving} save={()=>void save()} closeMeeting={()=>void closeMeeting()}/>}
  </Stack>}
  </Container></Box>;
}
