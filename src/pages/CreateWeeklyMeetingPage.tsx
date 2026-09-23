import { Alert, Box, Button, Container, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadAttendanceInsightMembers } from "../services/reporting";
import { createWeeklyMeeting, defaultActivityPlans, defaultBadgeworkPlans, loadWeeklyAccess } from "../services/weeklyTracker";
import { reconcileOpenWeeklyRoster } from "../services/weeklyTrackerLogic";
import { recordAuditEvent } from "../services/auditLog";

const GROUP_SECTIONS=["Beavers","Cubs","Scouts","Ventures","Rovers"];
const today=new Date().toISOString().slice(0,10);

export default function CreateWeeklyMeetingPage(){
 const {adminProfile}=useAdminAuth(); const navigate=useNavigate();
 const isAdmin=adminProfile?.role==="admin"||adminProfile?.role==="super-admin";
 const [section,setSection]=useState(""); const [date,setDate]=useState(today); const [location,setLocation]=useState(""); const [theme,setTheme]=useState("");
 const [programmeNotes,setProgrammeNotes]=useState(""); const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const [accessLoaded,setAccessLoaded]=useState(false); const [canViewAll,setCanViewAll]=useState(false);
 const sections=useMemo(()=>isAdmin||canViewAll?GROUP_SECTIONS:adminProfile?.sections??[],[isAdmin,canViewAll,adminProfile?.sections]);
 useEffect(()=>{void loadWeeklyAccess().then(a=>setCanViewAll(a.canViewAll)).catch(()=>setError("Unable to load meeting access.")).finally(()=>setAccessLoaded(true));},[]);
 useEffect(()=>{if(!section&&sections.length)setSection(sections[0]);},[section,sections]);
 const save=async()=>{if(saving)return;if(!section||!date){setError("Choose a section and meeting date.");return;}setSaving(true);setError("");
  try{const members=await loadAttendanceInsightMembers({isAdmin:Boolean(isAdmin||canViewAll),sections:adminProfile?.sections??[]});
   const roster=reconcileOpenWeeklyRoster([],members,section);
   if(!roster.length)throw new Error("No active members are available for that section.");
   const input={section,meetingDate:date,status:"open" as const,location,theme,activities:defaultActivityPlans(),badgeworkPlan:defaultBadgeworkPlans(),programmeNotes,notes:"",entries:roster,injuries:[]};
   const id=await createWeeklyMeeting(input);
   await recordAuditEvent({category:"system",action:"weekly-meeting-create",targetId:id,targetLabel:`${section} Weekly Meeting · ${date}`,description:"Created weekly meeting from dedicated creation workflow.",section});
   navigate(`/leader/weekly?meeting=${encodeURIComponent(id)}`);
  }catch(e){console.error(e);setError(e instanceof Error?e.message:"Unable to create this meeting.");}finally{setSaving(false);}
 };
 return <Box sx={{minHeight:"100vh",backgroundColor:"background.default",py:{xs:2,md:5}}}><Container maxWidth="md"><LeaderDashboardHeader/><LeaderPageHeader title="Create Meeting" description=""/>{error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}{!accessLoaded?<Typography role="status">Loading meeting access…</Typography>:<Paper variant="outlined" sx={{p:{xs:2,sm:3}}}><Stack spacing={2}><TextField select required label="Section" value={section} onChange={e=>setSection(e.target.value)}>{sections.map(s=><MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField><TextField required label="Meeting date" type="date" value={date} onChange={e=>setDate(e.target.value)} slotProps={{inputLabel:{shrink:true}}}/><TextField label="Location" value={location} onChange={e=>setLocation(e.target.value)}/><TextField label="Theme / programme title" value={theme} onChange={e=>setTheme(e.target.value)}/><TextField multiline minRows={4} label="Programme notes" value={programmeNotes} onChange={e=>setProgrammeNotes(e.target.value)}/><Typography variant="body2" color="text.secondary">More than one meeting may be created on the same date. Each meeting is stored under its own stable record ID.</Typography><Stack direction={{xs:"column",sm:"row"}} spacing={1}><Button variant="contained" color="success" disabled={saving} onClick={()=>void save()}>{saving?"Creating…":"Create Meeting"}</Button><Button variant="outlined" disabled={saving} onClick={()=>navigate("/leader/weekly")}>Cancel</Button></Stack></Stack></Paper>}</Container></Box>;
}