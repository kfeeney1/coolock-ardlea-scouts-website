import MeetingIncidentLeaveGuard from "../components/admin/MeetingIncidentLeaveGuard";
import { useMeetingIncidentDraft } from "../hooks/useMeetingIncidentDraft";
import { saveWeeklyMeetingWrites, saveWeeklyMeetingInBackground } from "../services/weeklyMeetingSaveWrites";
import MeetingProgrammeShareDialog from "../components/admin/MeetingProgrammeShareDialog";
import { useSavedWeeklyProgrammeShare } from "../hooks/useSavedWeeklyProgrammeShare";
import { meetingStage, initialMeetingStage, meetingBadgeworkHref } from "../services/meetingWorkflow";
import MeetingWorkflowControls from "../components/admin/MeetingWorkflowControls";
import MeetingWorkflowPanels from "../components/admin/MeetingWorkflowPanels";
import { useMeetingExperience } from "../hooks/useMeetingExperience";
import WeeklyMeetingSchedule from "../components/admin/WeeklyMeetingSchedule";
import { useScheduleExperience } from "../hooks/useScheduleExperience";
import { useAttendanceExperience } from "../hooks/useAttendanceExperience";
import { applicationErrorMessage, reportApplicationError } from "../services/applicationErrors.ts";
import { Alert, Box, Button, Chip, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import ProgrammeEquipmentDialog from "../components/admin/ProgrammeEquipmentDialog";
import WeeklyMeetingHistoryPanel from "../components/admin/WeeklyMeetingHistoryPanel";
import WeeklyMeetingEditorControls from "../components/admin/WeeklyMeetingEditorControls";
import WeeklyMeetingSaveActions from "../components/admin/WeeklyMeetingSaveActions";
import { useSaveOnNavigation } from "../hooks/useSaveOnNavigation";
import { useWeeklyLeaderAttendance } from "../hooks/useWeeklyLeaderAttendance";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadAttendanceInsightMembers } from "../services/reporting";
import type { AttendanceInsightMember } from "../services/attendanceInsightsLogic";
import { loadWeeklyAccess, loadWeeklyMeetings, reopenWeeklyMeeting, updatePastWeeklyMeeting, updateWeeklyMeeting } from "../services/weeklyTracker";
import type { WeeklyAccess, WeeklyLeaderOption, WeeklyMeetingRecord } from "../services/weeklyTracker";
import { canEditPastWeeklyMeeting, weeklyMeetingEditMode } from "../services/weeklyMeetingPermissions";
import { displayWeeklyDate, initialWeeklyStep, reconcileOpenWeeklyRoster, sortOpenWeeklyMeetings, totalProgrammeDuration, weeklyMeetingHasChanges } from "../services/weeklyTrackerLogic";
import { useWeeklyMeetingShare } from "../hooks/useWeeklyMeetingShare";
import { recordAuditEvent } from "../services/auditLog";
import { loadEquipmentItems } from "../services/equipment";
import type { EquipmentItem } from "../services/equipment";
import { loadEquipmentLoans } from "../services/equipmentLoans";
import type { EquipmentLoan } from "../services/equipmentLoans";
import { effectiveOperationalSections } from "../services/leaderAccessLogic";
import { trySecondaryRefresh } from "../services/secondaryRefresh";
import { loadLeaderAttendanceOptions } from "../services/leaderAttendance";
import { reopenWeeklyMeetingAndNavigate } from "../services/weeklyMeetingReopenFlow.ts";

type Step = "attendance" | "programme" | "badgework" | "injuries" | "notes";
type NavigationAction = "meetings" | "copy" | "create";

export default function WeeklySectionTracker() {
  const { adminProfile } = useAdminAuth();
  const redesignedSchedules = useScheduleExperience();
  const attendanceMatrixEnabled = useAttendanceExperience();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const meetingId=searchParams.get("meeting")??"";
  const workflow=useMeetingExperience(meetingId);
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
  const [selectedRecord,setSelected]=useState<WeeklyMeetingRecord|null>(null);
  // Expose only the meeting named by the committed route.
  const selected=selectedRecord?.id===meetingId?selectedRecord:null;
  const [savedSelected,setSavedSelected]=useState<WeeklyMeetingRecord|null>(null);
  const [step,setStep]=useState<Step>("attendance");
  const incident=useMeetingIncidentDraft(meetingId,workflow.redesigned);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const saveInFlight=useRef<Promise<boolean>|null>(null);
  const reopenInFlight=useRef(false);
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
  const {url:whatsappUrl,loading:shareLoading,error:shareError}=useWeeklyMeetingShare(workflow.redesigned?null:selected);
  const hasUnsavedChanges=weeklyMeetingHasChanges(selected,savedSelected)||leaderAttendanceChanged||incident.dirty;
  const adventureBadgeworkHref=meetingBadgeworkHref(selected,workflow.redesigned);

  const EditorControls=workflow.redesigned?MeetingWorkflowControls:WeeklyMeetingEditorControls;

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
      if(requested){setSelected(requested);setSavedSelected(requested);if(!(workflow.redesigned&&selected?.id===requested.id))setStep(workflow.redesigned?(initialMeetingStage(requested.status,requested.meetingDate,undefined,searchParams.get("stage"))):requested.status==="closed"?"attendance":initialWeeklyStep(requested.meetingDate));}
      else if(meetingId){setSelected(null);setSavedSelected(null);setError("This meeting could not be found or is outside your permitted sections.");}
    } catch(e){if(sequence===refreshSequence.current)setError(applicationErrorMessage(e, "Unable to load weekly meetings for your permitted scope.", "WeeklySectionTracker"));if(reportFailure)throw e;}
    finally{if(sequence===refreshSequence.current)setLoading(false);}
  };
  useEffect(()=>{if(workflow.ready)void refresh();},[availableSections,isAdmin,meetingId,workflow.ready]);
  useEffect(()=>{if(!meetingId){setSelected(null);setSavedSelected(null);}},[meetingId]);
  useEffect(()=>{if(!selected||selected.status!=="open")return;const reconciled=reconcileOpenWeeklyRoster(selected.entries,members,selected.section);if(JSON.stringify(reconciled)!==JSON.stringify(selected.entries))setSelected({...selected,entries:reconciled});},[members,selected?.id,selected?.status,selected?.section]);

  const auditWeeklyMeeting=async(record:WeeklyMeetingRecord,action:string,description:string)=>recordAuditEvent({category:"system",action,targetId:record.id,targetLabel:`${record.section} Weekly Meeting · ${record.meetingDate}`,description,section:record.section});
  const reopenMeeting=async(record:WeeklyMeetingRecord)=>{
    if(reopenInFlight.current)return;
    reopenInFlight.current=true;
    setSaving(true);setError("");setSuccess("");
    try{
      await reopenWeeklyMeetingAndNavigate(
        record,
        reopenWeeklyMeeting,
        (path)=>{
          setSelected(null);setSavedSelected(null);setLoading(true);
          setSuccess("Meeting reopened.");
          navigate(path);
        },
        (meeting)=>auditWeeklyMeeting(meeting,"weekly-meeting-reopen","Reopened meeting; previous closure and meeting data retained."),
        (error)=>reportApplicationError(error,{area:"WeeklySectionTracker",operation:"Audit reopened meeting",identifiers:{recordId:record.id,section:record.section}})
      );
    }catch(e){
      setError(applicationErrorMessage(e, "Unable to reopen this meeting.", "WeeklySectionTracker"));
    }finally{
      reopenInFlight.current=false;setSaving(false);
    }
  };
  const patch=(p:Partial<WeeklyMeetingRecord>)=>setSelected(c=>c?{...c,...p}:c);
  const persist=async(next:WeeklyMeetingRecord,message:string,action="weekly-meeting-update"):Promise<boolean>=>{
    // A second explicit save must not silently reuse an earlier save of a different snapshot.
    // Wait for the in-flight operation, then persist the latest requested meeting state.
    const editingPast=selected?.id===next.id&&selected.status==="closed";
    if(editingPast&&!editMode.canEditOperationalFields)return false;
    if(!editingPast&&readOnly)return false;
    setSaving(true);setError("");setSuccess("");
    if(saveInFlight.current)await saveInFlight.current;
    const pending=(async()=>{
      try{
        await saveWeeklyMeetingWrites(next,editingPast,{updateOpen:updateWeeklyMeeting,updatePast:updatePastWeeklyMeeting,saveLeaders:saveActivityLeaderAttendance});
        setSelected(next);setSavedSelected(next);
        // Data writes acknowledge before audit and refresh.
        setSuccess(message);
        let auditWarning="";
        try {
          await auditWeeklyMeeting(next,action,message);
        } catch (auditError) {
          const report=reportApplicationError(auditError,{area:"WeeklySectionTracker",operation:"Record meeting activity",userMessage:"The meeting was saved, but its activity log could not be updated."});
          auditWarning=` The activity log could not be updated. Reference: ${report.diagnostic.reference}.`;
        }
        const refreshed=await trySecondaryRefresh(()=>refresh(access,true),"weekly meetings");
        const refreshWarning=refreshed?"":" The meeting was saved, but the screen could not refresh. Reload the page to see the saved record.";
        setSuccess(`${message}${auditWarning}${refreshWarning}`);
        return true;
      }catch(e){setError(applicationErrorMessage(e, "Unable to save this meeting.", "WeeklySectionTracker"));return false;}
      finally{setSaving(false);saveInFlight.current=null;}
    })();
    saveInFlight.current=pending;
    return pending;
  };
  const persistWithIncident=async(record:WeeklyMeetingRecord,message="Meeting saved.",action?:string)=>{try{const next=incident.include(record);const saved=await persist(next,message,action);if(saved&&incident.dirty)incident.clear();return saved;}catch(cause){setStep("attendance");setError(applicationErrorMessage(cause,"Unable to save incident. Your form is retained in Run.","WeeklySectionTracker"));return false;}};
  const programmeShare=useSavedWeeklyProgrammeShare(operationalReadOnly?savedSelected:selected, snapshot=>operationalReadOnly?Promise.resolve(true):persistWithIncident(snapshot));
  const save=async()=>{if(selected&&await persistWithIncident(selected))requestAnimationFrame(()=>editorTopRef.current?.scrollIntoView({behavior:"smooth",block:"start"}));};
  const closeMeeting=async()=>{if(!selected)return false;const closed={...selected,status:"closed" as const};if(!(await persistWithIncident(closed,"Meeting closed and added to history.","weekly-meeting-close")))return false;setSelected(null);setSavedSelected(null);navigate("/leader/weekly",{replace:true});return true;};

  const saveForNavigation=async()=>!!selected&&(!hasUnsavedChanges||await persistWithIncident(selected));
  useSaveOnNavigation(hasUnsavedChanges&&!incident.dirty,saveForNavigation,()=>!selected||readOnly||selected.status==="closed"?Promise.resolve(false):saveWeeklyMeetingInBackground(selected,saveInFlight,{updateOpen:updateWeeklyMeeting,saveLeaders:saveActivityLeaderAttendance},setSavedSelected));

  const applyNavigationAction=(action:NavigationAction)=>{const current=selected;if(action==="copy"&&current){navigate(`/leader/weekly/copy/${encodeURIComponent(current.id)}`);return;}setSelected(null);setSavedSelected(null);if(action==="meetings")navigate("/leader/weekly",{replace:true});else if(action==="create")navigate("/leader/weekly/create");};
  const requestNavigationAction=async(action:NavigationAction)=>{if(programmeShare.busy)return;if(hasUnsavedChanges&&selected&&!(await persistWithIncident(selected)))return;applyNavigationAction(action);};

  const openRecords=sortOpenWeeklyMeetings(records.filter(r=>r.status==="open")),history=records.filter(r=>r.status==="closed");
  const present=selected?.entries.filter(e=>e.attendance==="present").length??0,total=selected?.entries.length??0;

  return <Box data-testid="page-weekly-meetings" sx={{minHeight:"100vh",backgroundColor:"background.default",py:{xs:2,md:5},overflowX:"hidden"}}><Container maxWidth="lg" sx={{px:{xs:1.5,sm:3}}}><LeaderDashboardHeader/><LeaderPageHeader title="Weekly Meetings" description=""/>{error&&<Alert severity="error" sx={{mb:2}}>{error}<Button onClick={()=>void refresh()}>Retry meetings</Button></Alert>}{shareError&&<Alert severity="error" sx={{mb:2}}>{shareError}</Alert>}{success&&<Alert severity="success" sx={{mb:2}}>{success}</Alert>}
  {loading||!workflow.ready?<Box sx={{minHeight:300,display:"grid",placeItems:"center"}}><CircularProgress aria-label="Loading weekly meetings"/></Box>:!selected?<Stack spacing={2}>
    {!readOnly&&<Button component={Link} to="/leader/weekly/create" variant="contained" color="success" size="large" sx={{alignSelf:"flex-start"}}>Create Meeting</Button>}
    {redesignedSchedules ? <WeeklyMeetingSchedule records={records} readOnly={readOnly} canEditAll={!!isAdmin || access.canEditAll} sections={availableSections} /> : <>
    <Paper variant="outlined" sx={{p:{xs:1.5,sm:2}}}><Typography variant="h5" sx={{fontWeight:800,mb:2}}>Open Meeting</Typography>{!openRecords.length?<Alert severity="info">No meetings are currently open.</Alert>:<Stack spacing={1}>{openRecords.map(r=><Button key={r.id} variant="contained" onClick={()=>{setSelected(r);setSavedSelected(r);setStep(initialWeeklyStep(r.meetingDate));navigate(`?meeting=${r.id}`);}} sx={{justifyContent:"space-between",gap:1,textAlign:"left",minWidth:0}}><span>{displayWeeklyDate(r.meetingDate)} · {r.section}</span><Chip size="small" label="Open"/></Button>)}</Stack>}</Paper>
    </>}
    {attendanceMatrixEnabled && <Button component={Link} to="/leader/attendance?view=matrix" variant="contained" color="primary" data-testid="weekly-attendance-matrix-link" sx={{ alignSelf: "flex-start", minHeight: 44, width: { xs: "100%", sm: "auto" }, whiteSpace: "normal" }}>Attendance Matrix</Button>}
    <WeeklyMeetingHistoryPanel records={history} sections={availableSections} canEditPast={canEditPast} readOnly={readOnly} canDeleteFutureClosed={isAdmin} onReopen={(record)=>void reopenMeeting(record)} onRefresh={()=>refresh(access)} />


  </Stack>:<Stack spacing={2} sx={{minWidth:0,pb:{xs:"calc(104px + env(safe-area-inset-bottom))",sm:"calc(64px + env(safe-area-inset-bottom))"}}}>
    {workflow.changed&&<Alert severity="info">The meeting workflow setting changed. This editor keeps its current layout and edits. The new layout applies after leaving this meeting.</Alert>}
    <EditorControls onShare={()=>void programmeShare.start()} saving={saving||programmeShare.busy} dirty={hasUnsavedChanges} error={error} selected={selected} step={step} setStep={setStep} programmeDuration={programmeDuration} present={present} total={total} operationalReadOnly={operationalReadOnly} planningReadOnly={planningReadOnly} readOnly={readOnly} shareLoading={shareLoading} shareError={shareError??""} whatsappUrl={whatsappUrl} editorTopRef={editorTopRef} requestNavigationAction={requestNavigationAction} setEquipmentOpen={setEquipmentOpen}/>
    <Box component="fieldset" disabled={programmeShare.busy||saving} sx={{border:0,p:0,m:0,minWidth:0}}>
    <MeetingWorkflowPanels busy={saving||programmeShare.busy} onOpenBadgework={async()=>{if(!saving&&!programmeShare.busy&&await saveForNavigation())navigate(adventureBadgeworkHref);}} redesigned={workflow.redesigned} step={step} attendance={{ entries: selected.entries, present, total, readOnly: operationalReadOnly, onEntriesChange: (entries)=>patch({entries}), leaders, leaderAttendance, onLeaderAttendanceChange: setLeaderAttendance, leaderAttendanceLoading }} programme={{ selected, selectedSectionLeaders, planningReadOnly, programmeDuration, setEquipmentOpen, patch }} details={{ step, selected, present, planningReadOnly, operationalReadOnly, adventureBadgeworkHref, ...incident.fields, patch }} />
    </Box>
    <ProgrammeEquipmentDialog open={equipmentOpen} sourceType="weeklyMeeting" sourceId={selected.id} sourceLabel={`${selected.section} Weekly Meeting · ${selected.meetingDate}`} section={selected.section} date={selected.meetingDate} items={equipmentItems} loans={equipmentLoans} readOnly={planningReadOnly} onClose={()=>setEquipmentOpen(false)} onChanged={async()=>{setEquipmentLoans(await loadEquipmentLoans());}} />
    {!operationalReadOnly&&<WeeklyMeetingSaveActions confirmClose={workflow.redesigned} review={workflow.redesigned&&meetingStage(step)!=="review"?()=>setStep("badgework"):undefined} error={error} share={workflow.redesigned&&meetingStage(step)==="plan"?()=>void programmeShare.start():undefined} stateLabel={workflow.redesigned?(saving?"Saving…":error?"Save failed — your edits are retained":hasUnsavedChanges?"Unsaved changes":"Saved"):undefined} selected={selected} saving={saving||programmeShare.busy} save={()=>void save()} closeMeeting={closeMeeting}/>}
  </Stack>}
  {workflow.redesigned&&selected&&<MeetingIncidentLeaveGuard key={meetingId} dirty={incident.dirty} save={saveForNavigation} saving={saving||programmeShare.busy}/>}
  <MeetingProgrammeShareDialog {...programmeShare}/>
  </Container></Box>;
}
