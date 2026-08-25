import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Container, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadAttendanceInsightMembers } from "../services/reporting";
import type { AttendanceInsightMember } from "../services/attendanceInsightsLogic";
import { createWeeklyMeeting, loadWeeklyAccess, loadWeeklyMeetings, updateWeeklyMeeting } from "../services/weeklyTracker";
import type { InjurySeverity, WeeklyAccess, WeeklyInjury, WeeklyMeetingRecord } from "../services/weeklyTracker";
import { newWeeklyEntry } from "../services/weeklyTrackerLogic";

const GROUP_SECTIONS = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
const today = new Date().toISOString().slice(0, 10);
type Step = "attendance" | "badgework" | "injuries" | "notes";

function displayDate(value: string) { const parsed = new Date(`${value}T00:00:00`); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(parsed); }

export default function WeeklySectionTracker() {
  const { adminProfile } = useAdminAuth();
  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
  const [access, setAccess] = useState<WeeklyAccess>({ scoutingRole: "", canViewAll: false, canEditAll: false, readOnly: false });
  const [members, setMembers] = useState<AttendanceInsightMember[]>([]);
  const [records, setRecords] = useState<WeeklyMeetingRecord[]>([]);
  const [selected, setSelected] = useState<WeeklyMeetingRecord | null>(null);
  const [step, setStep] = useState<Step>("attendance");
  const [createDate, setCreateDate] = useState(today);
  const [createSection, setCreateSection] = useState("");
  const [copyDate, setCopyDate] = useState(today);
  const [copySource, setCopySource] = useState<WeeklyMeetingRecord | null>(null);
  const [injuryMemberId, setInjuryMemberId] = useState("");
  const [injuryConcern, setInjuryConcern] = useState("");
  const [injurySeverity, setInjurySeverity] = useState<InjurySeverity>("minor");
  const [injuryAction, setInjuryAction] = useState("");
  const [injuryParentInformed, setInjuryParentInformed] = useState(false);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");

  const editableAll = isAdmin || access.canEditAll;
  const viewAll = isAdmin || access.canViewAll;
  const availableSections = useMemo(() => viewAll ? GROUP_SECTIONS : adminProfile?.sections ?? [], [adminProfile?.sections, viewAll]);
  const readOnly = !isAdmin && access.readOnly;

  const refresh = async (knownAccess?: WeeklyAccess) => {
    setLoading(true); setError("");
    try {
      const resolvedAccess = knownAccess ?? await loadWeeklyAccess(); setAccess(resolvedAccess);
      const all = isAdmin || resolvedAccess.canViewAll;
      const [loadedMembers, loadedRecords] = await Promise.all([
        loadAttendanceInsightMembers({ isAdmin: Boolean(isAdmin || resolvedAccess.canViewAll), sections: adminProfile?.sections ?? [] }),
        loadWeeklyMeetings(adminProfile?.sections ?? [], Boolean(isAdmin), all)
      ]);
      setMembers(loadedMembers.filter((member) => member.status === "active")); setRecords(loadedRecords);
      if (selected) setSelected(loadedRecords.find((record) => record.id === selected.id) ?? selected);
      const choices = all ? GROUP_SECTIONS : adminProfile?.sections ?? []; if (!createSection && choices.length) setCreateSection(choices[0]);
    } catch (e) { console.error(e); setError("Unable to load weekly meetings for your permitted scope."); } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [adminProfile?.sections, isAdmin]);

  const patchSelected = (patch: Partial<WeeklyMeetingRecord>) => setSelected((current) => current ? { ...current, ...patch } : current);
  const saveSelected = async (message = "Meeting saved.") => {
    if (!selected || readOnly) return; setSaving(true); setError(""); setSuccess("");
    try { const { id, ...input } = selected; await updateWeeklyMeeting(id, input); setSuccess(message); await refresh(access); } catch (e) { console.error(e); setError("Unable to save this meeting."); } finally { setSaving(false); }
  };

  const createMeeting = async () => {
    setError(""); setSuccess(""); if (!createSection || !createDate) return setError("Choose a section and meeting date.");
    if (records.some((r) => r.section === createSection && r.meetingDate === createDate && r.status === "open")) return setError("An open meeting already exists for that section and date.");
    const roster = members.filter((m) => m.section === createSection).map((m) => newWeeklyEntry(m.id, m.displayName));
    if (!roster.length) return setError("No active members are available for that section.");
    setSaving(true);
    try {
      const id = await createWeeklyMeeting({ section: createSection, meetingDate: createDate, status: "open", location: "", plannedActivities: "", plannedBadgework: "", programmeNotes: "", notes: "", entries: roster, injuries: [] });
      await refresh(access); setSelected({ id, section: createSection, meetingDate: createDate, status: "open", location: "", plannedActivities: "", plannedBadgework: "", programmeNotes: "", notes: "", entries: roster, injuries: [] }); setStep("attendance"); setSuccess("Meeting created.");
    } catch (e) { console.error(e); setError("Unable to create this meeting."); } finally { setSaving(false); }
  };

  const copyMeeting = async () => {
    if (!copySource || !copyDate) return; setError("");
    if (records.some((r) => r.section === copySource.section && r.meetingDate === copyDate)) return setError("A meeting already exists for that section and date.");
    const roster = members.filter((m) => m.section === copySource.section).map((m) => newWeeklyEntry(m.id, m.displayName));
    const fallback = copySource.entries.map((e) => newWeeklyEntry(e.memberId, e.memberName));
    setSaving(true);
    try {
      const input = { section: copySource.section, meetingDate: copyDate, status: "open" as const, location: copySource.location, plannedActivities: copySource.plannedActivities, plannedBadgework: copySource.plannedBadgework, programmeNotes: copySource.programmeNotes, notes: "", entries: roster.length ? roster : fallback, injuries: [] };
      const id = await createWeeklyMeeting(input); setSelected({ id, ...input }); setCopySource(null); setStep("attendance"); setSuccess("Meeting copied. Attendance, completed badgework, injuries and post-meeting notes were reset."); await refresh(access);
    } catch (e) { console.error(e); setError("Unable to copy this meeting."); } finally { setSaving(false); }
  };

  const addInjury = () => {
    if (!selected || !injuryMemberId || !injuryConcern.trim()) return;
    const member = selected.entries.find((e) => e.memberId === injuryMemberId); if (!member) return;
    const injury: WeeklyInjury = { memberId: member.memberId, memberName: member.memberName, concern: injuryConcern, severity: injurySeverity, actionTaken: injuryAction, parentInformed: injuryParentInformed, recordedAt: new Date().toISOString() };
    patchSelected({ injuries: [...selected.injuries, injury] }); setInjuryConcern(""); setInjuryAction(""); setInjuryParentInformed(false);
  };

  const openRecords = records.filter((r) => r.status === "open"); const history = records.filter((r) => r.status === "closed");
  const present = selected?.entries.filter((e) => e.attendance === "present").length ?? 0; const total = selected?.entries.length ?? 0;

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 3, md: 5 } }}><Container maxWidth="lg">
    <LeaderDashboardHeader /><LeaderPageHeader title="Weekly Meetings" description="Create a meeting, take attendance, record badgework and incidents, then close it into Meeting History." />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
    {loading ? <Box sx={{ minHeight: 300, display: "grid", placeItems: "center" }}><CircularProgress /></Box> : !selected ? <Stack spacing={2}>
      {!readOnly && <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Create Meeting</Typography><Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField select label="Section" value={createSection} onChange={(e) => setCreateSection(e.target.value)} disabled={!editableAll && availableSections.length === 1} sx={{ minWidth: 220 }}>{availableSections.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
        <TextField label="Meeting date" type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Button variant="contained" color="success" onClick={() => void createMeeting()} disabled={saving}>Create Meeting</Button>
      </Stack></Paper>}
      <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Open Meeting</Typography>{openRecords.length === 0 ? <Alert severity="info">No meetings are currently open.</Alert> : <Stack spacing={1}>{openRecords.map((r) => <Button key={r.id} variant="outlined" onClick={() => { setSelected(r); setStep("attendance"); }} sx={{ justifyContent: "space-between" }}><span>{displayDate(r.meetingDate)} · {r.section}</span><Chip size="small" label="Open" /></Button>)}</Stack>}</Paper>
      <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Meeting History</Typography>{history.length === 0 ? <Alert severity="info">No closed meetings yet.</Alert> : <Stack spacing={1}>{history.map((r) => { const p = r.entries.filter((e) => e.attendance === "present").length; return <Paper key={r.id} variant="outlined" sx={{ p: 1.5 }}><Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}><Box><Typography sx={{ fontWeight: 800 }}>{displayDate(r.meetingDate)} · {r.section}</Typography><Typography color="text.secondary">{p}/{r.entries.length} Present · Closed</Typography></Box><Stack direction="row" spacing={1}><Button onClick={() => { setSelected(r); setStep("attendance"); }}>View / Edit</Button>{!readOnly && <Button onClick={() => { setCopySource(r); setCopyDate(today); }}>Copy Meeting</Button>}</Stack></Stack></Paper>; })}</Stack>}</Paper>
      {copySource && <Paper variant="outlined" sx={{ p: 2 }}><Typography sx={{ fontWeight: 800, mb: 1 }}>Copy {displayDate(copySource.meetingDate)} · {copySource.section}</Typography><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button variant="outlined" onClick={() => setCopyDate(today)}>Today</Button><TextField label="Choose date" type="date" value={copyDate} onChange={(e) => setCopyDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><Button variant="contained" onClick={() => void copyMeeting()} disabled={saving}>Create Copy</Button><Button onClick={() => setCopySource(null)}>Cancel</Button></Stack></Paper>}
    </Stack> : <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}><Box><Typography variant="h5" sx={{ fontWeight: 800 }}>{selected.section} · {displayDate(selected.meetingDate)}</Typography><Chip size="small" label={selected.status === "open" ? "Open" : "Closed"} /></Box><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}><Button onClick={() => setSelected(null)}>Meetings</Button>{!readOnly && <Button onClick={() => { setCopySource(selected); setCopyDate(today); setSelected(null); }}>Copy Meeting</Button>}{!readOnly && selected.status === "closed" && <Button variant="outlined" onClick={() => { patchSelected({ status: "open" }); setTimeout(() => void saveSelected("Meeting reopened."), 0); }}>Reopen Meeting</Button>}</Stack></Stack></Paper>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>{(["attendance","badgework","injuries","notes"] as Step[]).map((s) => <Button key={s} variant={step === s ? "contained" : "outlined"} onClick={() => setStep(s)}>{s === "badgework" ? "Badgework" : s === "injuries" ? "Injuries / Medical" : s[0].toUpperCase()+s.slice(1)}</Button>)}</Stack>
      {step === "attendance" && <Paper variant="outlined" sx={{ p: 2 }}><Stack direction="row" sx={{ justifyContent: "space-between", mb: 2 }}><Typography variant="h5" sx={{ fontWeight: 800 }}>Attendance</Typography><Chip color="success" label={`${present}/${total} Present`} /></Stack>{!readOnly && <Button variant="outlined" sx={{ mb: 2 }} onClick={() => patchSelected({ entries: selected.entries.map((e) => ({ ...e, attendance: "present" })) })}>Mark all present</Button>}<Stack data-testid="attendance-list">{selected.entries.map((entry) => <FormControlLabel key={entry.memberId} control={<Checkbox disabled={readOnly} checked={entry.attendance === "present"} onChange={(e) => patchSelected({ entries: selected.entries.map((x) => x.memberId === entry.memberId ? { ...x, attendance: e.target.checked ? "present" : "absent" } : x) })} />} label={entry.memberName} slotProps={{ typography: { fontWeight: 700 } }} />)}</Stack></Paper>}
      {step === "badgework" && <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Badgework</Typography><TextField fullWidth label="Planned badgework" value={selected.plannedBadgework} disabled={readOnly} onChange={(e) => patchSelected({ plannedBadgework: e.target.value })} sx={{ mb: 2 }} />{selected.entries.filter((e) => e.attendance === "present").map((entry) => <TextField key={entry.memberId} fullWidth sx={{ mb: 1 }} label={`Badges · ${entry.memberName}`} disabled={readOnly} value={entry.badges.join(", ")} onChange={(e) => patchSelected({ entries: selected.entries.map((x) => x.memberId === entry.memberId ? { ...x, badges: e.target.value.split(",").map((b) => b.trim()).filter(Boolean) } : x) })} />)}{present === 0 && <Alert severity="info">Mark attendees present before recording badgework.</Alert>}</Paper>}
      {step === "injuries" && <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Injuries / Medical Issues</Typography>{selected.injuries.map((i, idx) => <Alert key={`${i.recordedAt}-${idx}`} severity={i.severity === "serious" ? "error" : i.severity === "moderate" ? "warning" : "info"} sx={{ mb: 1 }}>{i.memberName}: {i.concern} · {i.actionTaken || "No action recorded"} · Parent {i.parentInformed ? "informed" : "not informed"}</Alert>)}{!readOnly && <Stack spacing={1.5}><TextField select label="Member" value={injuryMemberId} onChange={(e) => setInjuryMemberId(e.target.value)}>{selected.entries.map((e) => <MenuItem key={e.memberId} value={e.memberId}>{e.memberName}</MenuItem>)}</TextField><TextField label="Injury / medical concern" value={injuryConcern} onChange={(e) => setInjuryConcern(e.target.value)} /><TextField select label="Severity" value={injurySeverity} onChange={(e) => setInjurySeverity(e.target.value as InjurySeverity)}><MenuItem value="minor">Minor</MenuItem><MenuItem value="moderate">Moderate</MenuItem><MenuItem value="serious">Serious</MenuItem></TextField><TextField label="Action taken" value={injuryAction} onChange={(e) => setInjuryAction(e.target.value)} /><FormControlLabel control={<Checkbox checked={injuryParentInformed} onChange={(e) => setInjuryParentInformed(e.target.checked)} />} label="Parent informed" /><Button variant="outlined" onClick={addInjury}>Add Incident</Button></Stack>}</Paper>}
      {step === "notes" && <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Additional Notes & Programme</Typography><Stack spacing={1.5}><TextField label="Location" value={selected.location} disabled={readOnly} onChange={(e) => patchSelected({ location: e.target.value })} /><TextField multiline minRows={2} label="Planned games & activities" value={selected.plannedActivities} disabled={readOnly} onChange={(e) => patchSelected({ plannedActivities: e.target.value })} /><TextField multiline minRows={2} label="Programme template notes" value={selected.programmeNotes} disabled={readOnly} onChange={(e) => patchSelected({ programmeNotes: e.target.value })} /><TextField multiline minRows={4} label="Additional meeting notes" helperText="Visitors, behaviour, activities completed, equipment issues and other post-meeting notes." value={selected.notes} disabled={readOnly} onChange={(e) => patchSelected({ notes: e.target.value })} /></Stack></Paper>}
      {!readOnly && <Paper elevation={3} sx={{ position: "sticky", bottom: 8, p: 1.5, display: "flex", gap: 1, justifyContent: "flex-end" }}><Button variant="outlined" onClick={() => void saveSelected()} disabled={saving}>Save Changes</Button>{selected.status === "open" && <Button variant="contained" color="success" onClick={() => { patchSelected({ status: "closed" }); setTimeout(() => void saveSelected("Meeting closed and added to history."), 0); }} disabled={saving}>Close Meeting</Button>}</Paper>}
    </Stack>}
  </Container></Box>;
}
