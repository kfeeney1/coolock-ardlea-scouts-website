import {Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography} from "@mui/material";
import {useEffect, useRef, useState} from "react";
import {useHallHireAccess} from "../../hooks/useHallHireAccess";
import {useConfirmEventLeave} from "../../hooks/useConfirmEventLeave";
import DatePickerField from "../DatePickerField";
import type {EventRecord} from "../../services/eventAdmin";
import {useAdminAuth} from "../admin/AdminAuthProvider";
import {canWriteEventHall} from "../../services/eventHallSchedule";
import {requestHallBooking} from "../../services/hallBookingClient";
import {applicationErrorMessage} from "../../services/applicationErrors";
import {hallInterval} from "../../services/hallBookingTime";
export default function EventHallUse({event: source, blocked = false, allowNew = true, onDirty, onSaved}: {event: EventRecord; blocked?: boolean; allowNew?: boolean; onDirty: (value: boolean) => void; onSaved: () => void}) {
  const access = useHallHireAccess();
  const {adminProfile} = useAdminAuth();
  const readOnly = !canWriteEventHall(adminProfile, source.section);
  const existing = source.hallResource === "group-hall";
  const [form, setForm] = useState(source.hallInterval ?? {date: source.startDate, startTime: "", endDate: source.startDate, endTime: ""});
  const [baseline, setBaseline] = useState(form);
  const [formVersion, setFormVersion] = useState(0);
  const busy = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState(""), [releaseOpen, setReleaseOpen] = useState(false), [invalidDate, setInvalidDate] = useState({date: false, endDate: false});
  const invalid = invalidDate.date || invalidDate.endDate;
  const dirty = invalid || JSON.stringify(form) !== JSON.stringify(baseline);
  useEffect(() => {onDirty(dirty || refreshing); return () => onDirty(false);}, [dirty, refreshing, onDirty]);
  async function persist(release = false) {
    if (busy.current || blocked || (!access.council || readOnly)) return false;
    if (!existing && !access.allowed) {setError("Hall Hire is disabled. Your draft is retained."); return false;}
    setError("");
    if (!release) {
      try {if (invalid) throw new Error(); hallInterval(form); if (form.date < source.startDate || form.endDate > source.endDate) throw new Error();}
      catch {setError("Enter valid dates within the event and unambiguous Europe/Dublin times. End must follow start, within seven days."); return false;}
    }
    busy.current = true; setSaving(true);
    try {
      const expectedRevision = source.hallRevision ?? 0;
      const result = await requestHallBooking<{id: string; revision: number}>({action: "event-hall", command: {id: source.id, expectedRevision, expectedStartDate: source.startDate, expectedEndDate: source.endDate, ...(release ? {release: true} : {interval: form})}});
      if (result.id !== source.id || result.revision !== expectedRevision + 1) throw new Error("The event hall save was not confirmed. Reopen it before trying again.");
      return true;
    } catch (cause) {setError(applicationErrorMessage(cause, "Unable to change hall use. Your details are retained.", "EventHallUse")); return false;}
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
      setBaseline(form); setInvalidDate({date: false, endDate: false});
    } else {leave.releaseAfterSuccessfulSave(); onSaved();}
  };
  if (!existing && (!allowNew || !access.allowed || readOnly) && !dirty) return null;
  const disabled = saving || refreshing || blocked || !access.council || readOnly || (!existing && !access.allowed);
  return <Paper variant="outlined" sx={{p: {xs: 1.5, sm: 2}, borderRadius: 3}} data-testid="event-hall-use"><Stack spacing={1.5}>
    <Typography component="h2" variant="h6" sx={{fontWeight: 800}}>Hall use · Europe/Dublin</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {blocked && <Alert severity="info">Save event changes before changing hall use.</Alert>}
    {!["open", "closed"].includes(source.status) && access.council && !readOnly && <Alert severity="info">Open the event before reserving or moving hall time. Existing hall time can be released.</Alert>}
    {existing && <Typography>This event reserves the Group hall.</Typography>}
    {existing && (!access.council || readOnly) && <Alert severity="info">Current Group Council and event write permissions are required to change hall use.</Alert>}
    {existing && <Alert severity="info">Release hall time before changing event dates or section, then reserve the new time. Another booking may take released time.</Alert>}
    <Stack component="form" spacing={1.5} onSubmit={event => {event.preventDefault(); void save();}}>
      <Stack direction={{xs: "column", sm: "row"}} spacing={1.5}>{(["date", "endDate"] as const).map(key => <DatePickerField key={`${key}:${formVersion}`} label={key === "date" ? "Hall start date" : "Hall end date"} value={form[key]} minDate={source.startDate} maxDate={source.endDate} disabled={disabled || !["open", "closed"].includes(source.status)} onInputValidityChange={valid => setInvalidDate(current => ({...current, [key]: !valid}))} onChange={event => {setForm(current => ({...current, [key]: event.target.value})); setInvalidDate(current => ({...current, [key]: false}));}} />)}</Stack>
      <Stack direction={{xs: "column", sm: "row"}} spacing={1.5}>{(["startTime", "endTime"] as const).map(key => <TextField key={key} fullWidth type="time" label={key === "startTime" ? "Hall start time" : "Hall end time"} value={form[key]} disabled={disabled || !["open", "closed"].includes(source.status)} onChange={event => setForm(current => ({...current, [key]: event.target.value}))} slotProps={{inputLabel: {shrink: true}, htmlInput: {step: 60}}} />)}</Stack>
      <Stack direction="row" useFlexGap sx={{flexWrap: "wrap"}} spacing={1}><Button type="submit" variant="contained" disabled={disabled || !["open", "closed"].includes(source.status)} sx={{minHeight: 44}}>{existing ? "Save hall schedule" : "Reserve Group hall"}</Button>{dirty && <Button disabled={saving} onClick={() => {setForm(baseline); setFormVersion(value => value + 1); setInvalidDate({date: false, endDate: false}); setError(""); leave.stay();}} sx={{minHeight: 44}}>Discard hall edits</Button>}{existing && <Button color="warning" disabled={disabled || dirty} onClick={() => setReleaseOpen(true)} sx={{minHeight: 44}}>Release hall</Button>}</Stack>
    </Stack>
    <Dialog open={releaseOpen} onClose={() => !saving && setReleaseOpen(false)} aria-labelledby="event-hall-release-title"><DialogTitle id="event-hall-release-title">Release this event’s hall time?</DialogTitle><DialogContent>The event, programme, audience and consent records are retained. Its hall time becomes available.</DialogContent><DialogActions><Button autoFocus disabled={saving} onClick={() => setReleaseOpen(false)}>Keep reservation</Button><Button disabled={saving} color="warning" onClick={() => void save(true)}>Confirm release</Button></DialogActions></Dialog>
    <Dialog open={leave.dialogOpen} onClose={leave.stay} aria-labelledby="event-hall-leave-title"><DialogTitle id="event-hall-leave-title">Unsaved hall schedule</DialogTitle><DialogActions><Button autoFocus disabled={saving} onClick={leave.stay}>Stay</Button><Button disabled={saving} color="error" onClick={leave.continueWithoutSaving}>Discard</Button><Button disabled={saving} onClick={() => void leave.saveAndContinue()}>Save</Button></DialogActions></Dialog>
  </Stack></Paper>;
}
