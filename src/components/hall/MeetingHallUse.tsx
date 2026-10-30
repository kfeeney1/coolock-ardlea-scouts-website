import {Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography} from "@mui/material";
import {useEffect, useRef, useState} from "react";
import {useHallHireAccess} from "../../hooks/useHallHireAccess";
import {useConfirmEventLeave} from "../../hooks/useConfirmEventLeave";
import DatePickerField from "../DatePickerField";
import type {WeeklyMeetingRecord} from "../../services/weeklyTracker";
import {requestHallBooking} from "../../services/hallBookingClient";
import {applicationErrorMessage} from "../../services/applicationErrors";
import {hallInterval} from "../../services/hallBookingTime";
export default function MeetingHallUse({meeting, blocked, readOnly, onDirty, onSaved}: {meeting: WeeklyMeetingRecord; blocked: boolean; readOnly: boolean; onDirty: (value: boolean) => void; onSaved: () => void}) {
  const access = useHallHireAccess();
  const existing = meeting.hallResource === "group-hall";
  const [form, setForm] = useState({date: meeting.meetingDate, startTime: meeting.hallStartTime ?? "", endTime: meeting.hallEndTime ?? ""});
  const [baseline, setBaseline] = useState(form);
  const busy = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState(""), [releaseOpen, setReleaseOpen] = useState(false), [invalidDate, setInvalidDate] = useState(false);
  const dirty = invalidDate || JSON.stringify(form) !== JSON.stringify(baseline);
  useEffect(() => {onDirty(dirty || refreshing); return () => onDirty(false);}, [dirty, refreshing, onDirty]);
  async function persist(release = false) {
    if (busy.current || blocked || (!access.council || readOnly)) return false;
    if (!existing && !access.allowed) {setError("Hall Hire is disabled. Your draft is retained."); return false;}
    setError("");
    if (!release) {
      try {if (invalidDate) throw new Error(); hallInterval({date: form.date, startTime: form.startTime, endDate: form.date, endTime: form.endTime});}
      catch {setError("Enter a valid date and unambiguous Europe/Dublin start/end times. End time must follow start time."); return false;}
    }
    busy.current = true; setSaving(true);
    try {
      const expectedRevision = meeting.hallRevision ?? 0;
      const result = await requestHallBooking<{id: string; revision: number}>({action: "meeting-hall", command: {id: meeting.id, expectedRevision, expectedDate: meeting.meetingDate, ...(release ? {release: true} : form)}});
      if (result.id !== meeting.id || result.revision !== expectedRevision + 1) throw new Error("The meeting hall save was not confirmed. Reopen it before trying again.");
      return true;
    } catch (cause) {setError(applicationErrorMessage(cause, "Unable to change hall use. Your details are retained.", "MeetingHallUse")); return false;}
    finally {busy.current = false; setSaving(false);}
  }
  const leave = useConfirmEventLeave(dirty, () => persist(), undefined, true);
  const pendingRefresh = useRef<(() => void) | null>(null);
  useEffect(() => () => {if (pendingRefresh.current) window.removeEventListener("popstate", pendingRefresh.current);}, []);
  const save = async (release = false) => {
    if (!(await persist(release))) return;
    setReleaseOpen(false); setRefreshing(true);
    if (dirty && leave.ownsBackEntry()) {
      // Let the shared guard consume its own reserved Back entry before refresh
      // remounts this panel. A saved schedule must not add an extra Android Back stop.
      const refresh = () => {pendingRefresh.current = null; onSaved();};
      pendingRefresh.current = refresh;
      window.addEventListener("popstate", refresh, {once: true});
      setBaseline(form); setInvalidDate(false);
    } else {leave.releaseAfterSuccessfulSave(); onSaved();}
  };
  if (!existing && !access.allowed && !dirty) return null;
  const disabled = saving || refreshing || blocked || !access.council || readOnly || (!existing && !access.allowed);
  return <Paper variant="outlined" sx={{p: {xs: 1.5, sm: 2}, borderRadius: 3}} data-testid="meeting-hall-use"><Stack spacing={1.5}>
    <Typography component="h2" variant="h6" sx={{fontWeight: 800}}>Hall use · Europe/Dublin</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {blocked && <Alert severity="info">Save meeting changes before changing hall use.</Alert>}
    {meeting.status === "closed" && access.council && !readOnly && <Alert severity="info">Reopen the meeting before reserving or moving hall time.</Alert>}
    {existing && <Typography>This meeting reserves the Group hall.</Typography>}
    {existing && (!access.council || readOnly) && <Alert severity="info">Current Group Council and meeting write permissions are required to change hall use.</Alert>}
    <Stack component="form" spacing={1.5} onSubmit={event => {event.preventDefault(); void save();}}>
      <DatePickerField label="Hall meeting date" name="hallMeetingDate" value={form.date} minDate="2000-01-01" maxDate="2099-12-31" disabled={disabled || meeting.status === "closed"} onInputValidityChange={valid => setInvalidDate(!valid)} onChange={event => {setForm(current => ({...current, date: event.target.value})); setInvalidDate(false);}} />
      <Stack direction={{xs: "column", sm: "row"}} spacing={1.5}>{(["startTime", "endTime"] as const).map(key => <TextField key={key} fullWidth type="time" label={key === "startTime" ? "Hall start time" : "Hall end time"} value={form[key]} disabled={disabled || meeting.status === "closed"} onChange={event => setForm(current => ({...current, [key]: event.target.value}))} slotProps={{inputLabel: {shrink: true}, htmlInput: {step: 60}}} />)}</Stack>
      <Stack direction="row" useFlexGap sx={{flexWrap: "wrap"}} spacing={1}><Button type="submit" variant="contained" disabled={disabled || meeting.status === "closed"} sx={{minHeight: 44}}>{existing ? "Save hall schedule" : "Reserve Group hall"}</Button>{dirty && <Button disabled={saving} onClick={() => {setForm(baseline); setInvalidDate(false); setError(""); leave.stay();}} sx={{minHeight: 44}}>Discard hall edits</Button>}{existing && <Button color="warning" disabled={disabled || dirty} onClick={() => setReleaseOpen(true)} sx={{minHeight: 44}}>Release hall</Button>}</Stack>
    </Stack>
    <Dialog open={releaseOpen} onClose={() => !saving && setReleaseOpen(false)} aria-labelledby="meeting-hall-release-title"><DialogTitle id="meeting-hall-release-title">Release this meeting’s hall time?</DialogTitle><DialogContent>The meeting and its programme are retained. Its hall time becomes available.</DialogContent><DialogActions><Button autoFocus disabled={saving} onClick={() => setReleaseOpen(false)}>Keep reservation</Button><Button disabled={saving} color="warning" onClick={() => void save(true)}>Confirm release</Button></DialogActions></Dialog>
    <Dialog open={leave.dialogOpen} onClose={leave.stay} aria-labelledby="meeting-hall-leave-title"><DialogTitle id="meeting-hall-leave-title">Unsaved hall schedule</DialogTitle><DialogActions><Button autoFocus disabled={saving} onClick={leave.stay}>Stay</Button><Button disabled={saving} color="error" onClick={leave.continueWithoutSaving}>Discard</Button><Button disabled={saving} onClick={() => void leave.saveAndContinue()}>Save</Button></DialogActions></Dialog>
  </Stack></Paper>;
}
