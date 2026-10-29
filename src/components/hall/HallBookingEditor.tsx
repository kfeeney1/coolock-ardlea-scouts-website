import { useRef, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Stack, Switch, TextField, Typography } from "@mui/material";
import DatePickerField from "../DatePickerField";
import { useConfirmEventLeave } from "../../hooks/useConfirmEventLeave";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { editHallOccurrence, hallBookingInput, hallOccurrenceInterval, hallSeriesDates, rescheduleHallSeries, validateHallBookingInput, type HallBookingInput } from "../../services/hallBookingAdministration.ts";
import { persistHallBooking } from "../../services/hallBookingClient";
import { formatSiteDate } from "../../services/siteDateFormat";

export default function HallBookingEditor({initial, revision, saved, savedNotice = false}: {initial: HallBookingInput; revision: number; saved: (id: string) => void; savedNotice?: boolean}) {
  const [form, setForm] = useState(() => hallBookingInput(initial));
  const [scope, setScope] = useState<"series" | "occurrence">("series");
  const [occurrence, setOccurrence] = useState(initial.interval.date);
  const [replacement, setReplacement] = useState(() => hallOccurrenceInterval(initial, initial.interval.date));
  const [cancelled, setCancelled] = useState(false), [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const inFlight = useRef(false), root = useRef<HTMLFormElement>(null);
  const [invalidDates, setInvalidDates] = useState<Record<string, boolean>>({});
  const invalidDate = (scope === "occurrence" && cancelled ? [] : ["date", "endDate", ...(scope === "series" && form.recurrence ? ["until"] : [])]).some(key => invalidDates[key]);
  const dateValidity = (key: string, valid: boolean) => setInvalidDates(value => value[key] === !valid ? value : {...value, [key]: !valid});
  const dirty = invalidDate || JSON.stringify(form) !== JSON.stringify(hallBookingInput(initial)) || (scope === "occurrence" && (cancelled !== (initial.exceptions?.find(item => item.date === occurrence)?.action === "cancel") || JSON.stringify(replacement) !== JSON.stringify(hallOccurrenceInterval(initial, occurrence))));
  const submit = async (override?: HallBookingInput) => {
    if (inFlight.current) return false;
    setError("");
    if (invalidDate) {setError("Enter valid booking dates before saving."); root.current?.focus(); return false;}
    let value: HallBookingInput;
    try {value = override ?? (scope === "occurrence" ? editHallOccurrence(initial, occurrence, replacement, cancelled) : rescheduleHallSeries(form, initial));}
    catch (failure) {setError(failure instanceof Error ? failure.message : "Check booking dates and exceptions."); root.current?.focus(); return false;}
    const validation = validateHallBookingInput(value);
    if (validation) {setError(validation); root.current?.focus(); return false;}
    inFlight.current = true; setSaving(true);
    try {await persistHallBooking(value, revision); leave.releaseAfterSuccessfulSave(); return true;}
    catch (failure) {setError(applicationErrorMessage(failure, "Unable to save this booking. Your edits are retained.", "HallBookingEditor")); return false;}
    finally {inFlight.current = false; setSaving(false);}
  };
  const leave = useConfirmEventLeave(dirty, () => submit());
  const save = async () => {if (await submit()) saved(initial.id);};
  const chooseOccurrence = (date: string) => {setOccurrence(date); setReplacement(hallOccurrenceInterval(initial, date)); setCancelled(initial.exceptions?.find(item => item.date === date)?.action === "cancel");};
  const field = (key: "title" | "hirerName" | "contact" | "notes", label: string, max: number) => <TextField fullWidth label={label} required={key === "title"} value={form[key]} onChange={event => setForm(value => ({...value, [key]: event.target.value}))} disabled={saving || scope === "occurrence"} multiline={key === "notes"} minRows={key === "notes" ? 3 : undefined} slotProps={{htmlInput: {maxLength: max}}} />;
  const interval = scope === "occurrence" ? replacement : form.interval;
  const setInterval = (key: keyof HallBookingInput["interval"], value: string) => {if (key === "date" || key === "endDate") dateValidity(key, true); if (scope === "occurrence") setReplacement(current => ({...current, [key]: value})); else setForm(current => ({...current, interval: {...current.interval, [key]: value}}));};
  return <Paper component="form" ref={root} tabIndex={-1} noValidate onSubmit={event => {event.preventDefault(); void save();}} variant="outlined" sx={{p: {xs: 1.5, sm: 3}, borderRadius: 3}}>
    <Stack spacing={2}>
      <Typography component="h2" variant="h5" sx={{fontWeight: 800}}>{revision ? initial.recurrence ? "Edit booking series" : "Edit booking" : "New hall booking"}</Typography>
      {savedNotice && revision > 0 && !dirty && !saving && !error && <Alert severity="success" role="status">Hall booking saved.</Alert>}
      {error && <Alert severity="error" role="alert">{error}</Alert>}
      {revision > 0 && initial.recurrence && <TextField select label="Edit scope" value={scope} disabled={saving || dirty} onChange={event => {setScope(event.target.value as "series" | "occurrence"); chooseOccurrence(occurrence);}}><MenuItem value="series">Entire series</MenuItem><MenuItem value="occurrence">One occurrence</MenuItem></TextField>}
      {scope === "occurrence" && <><TextField select label="Original occurrence date" value={occurrence} disabled={saving || dirty} onChange={event => chooseOccurrence(event.target.value)}>{hallSeriesDates(initial).map(date => <MenuItem key={date} value={date}>{formatSiteDate(date)}{initial.exceptions?.find(item => item.date === date)?.action === "cancel" ? " — cancelled" : ""}</MenuItem>)}</TextField><FormControlLabel label="Cancel this occurrence" control={<Switch checked={cancelled} disabled={saving} onChange={event => setCancelled(event.target.checked)} slotProps={{input: {role: "switch"}}} />} /></>}
      {field("title", "Booking title", 200)}
      <Stack direction={{xs: "column", sm: "row"}} spacing={2}>
        <TextField fullWidth select label="Booking type" value={form.kind} disabled={saving || scope === "occurrence"} onChange={event => setForm(value => ({...value, kind: event.target.value as HallBookingInput["kind"]}))}>{[["internal", "Internal"], ["external", "External hire"], ["blocked", "Blocked / unavailable"]].map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
        <TextField fullWidth select label="Booking status" value={form.state} disabled={saving || scope === "occurrence"} onChange={event => setForm(value => ({...value, state: event.target.value as HallBookingInput["state"]}))}>{[["draft", "Draft — does not reserve time"], ["confirmed", "Confirmed — reserves time"], ["cancelled", "Cancelled"]].map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
      </Stack>
      <Stack direction={{xs: "column", sm: "row"}} spacing={2}>
        {([['date', 'Start date'], ['endDate', 'End date']] as const).map(([key, label]) => <DatePickerField fullWidth key={key} label={label} value={interval[key]} onInputValidityChange={valid => dateValidity(key, valid)} onChange={event => setInterval(key, event.target.value)} minDate="2000-01-01" maxDate="2099-12-31" required disabled={saving || (scope === "occurrence" && cancelled)} />)}
      </Stack>
      <Stack direction={{xs: "column", sm: "row"}} spacing={2}>
        {([['startTime', 'Start time'], ['endTime', 'End time']] as const).map(([key, label]) => <TextField fullWidth key={key} type="time" label={label} required value={interval[key]} disabled={saving || (scope === "occurrence" && cancelled)} onChange={event => setInterval(key, event.target.value)} slotProps={{inputLabel: {shrink: true}, htmlInput: {step: 60}}} />)}
      </Stack>
      <Typography variant="body2" color="text.secondary">Europe/Dublin time. Adjacent bookings are allowed; overlapping reservations are rejected.</Typography>
      {scope === "series" && <>
        <FormControlLabel label="Repeat weekly" control={<Switch checked={Boolean(form.recurrence)} disabled={saving} onChange={event => setForm(value => ({...value, recurrence: event.target.checked ? {frequency: "weekly", until: value.interval.date} : undefined}))} slotProps={{input: {role: "switch"}}} />} />
        {form.recurrence && <DatePickerField label="Repeat until" value={form.recurrence.until} onInputValidityChange={valid => dateValidity("until", valid)} onChange={event => {dateValidity("until", true); setForm(value => ({...value, recurrence: {frequency: "weekly", until: event.target.value}}));}} minDate={form.interval.date} maxDate="2099-12-31" disabled={saving} required />}
        {initial.exceptions?.length && form.interval.date !== initial.interval.date ? <Alert severity="info">Moving this series moves its occurrence exceptions by the same number of days.</Alert> : null}
        {(form.exceptions ?? []).map(item => <Stack direction="row" spacing={1} sx={{alignItems: "center"}} key={item.date}><Typography sx={{flex: 1}}>{formatSiteDate(item.date)}: {item.action === "cancel" ? "Cancelled occurrence" : "Rescheduled occurrence"}</Typography><Button disabled={saving} onClick={() => setForm(value => ({...value, exceptions: value.exceptions?.filter(entry => entry.date !== item.date)}))}>Restore series time</Button></Stack>)}
      </>}
      {field("hirerName", "Hirer / group name", 200)}{field("contact", "Contact details", 300)}{field("notes", "Leader notes", 3000)}
      <Stack direction="row" spacing={1} useFlexGap sx={{flexWrap: "wrap", "& .MuiButton-root": {minHeight: 44}}}><Button type="submit" color="secondary" variant="contained" disabled={saving}>{saving ? "Saving…" : scope === "occurrence" ? "Save occurrence" : initial.recurrence ? "Save series" : "Save booking"}</Button>{revision > 0 && initial.state !== "cancelled" && scope === "series" && <Button color="error" disabled={saving || dirty} onClick={() => setConfirmCancel(true)}>{initial.recurrence ? "Cancel entire series" : "Cancel booking"}</Button>}</Stack>
      {saving && <Typography role="status">Saving hall booking…</Typography>}
    </Stack>
    <Dialog open={confirmCancel} onClose={() => !saving && setConfirmCancel(false)} aria-labelledby="hall-cancel-title"><DialogTitle id="hall-cancel-title">{initial.recurrence ? "Cancel the entire series?" : "Cancel this booking?"}</DialogTitle><DialogContent>Reserved time will be released. Booking records and audit history will be retained.</DialogContent><DialogActions><Button disabled={saving} onClick={() => setConfirmCancel(false)}>Keep booking</Button><Button color="error" disabled={saving} onClick={async () => {if (await submit({...hallBookingInput(initial), state: "cancelled"})) {setConfirmCancel(false); saved(initial.id);}}}>Confirm cancellation</Button></DialogActions></Dialog>
    <Dialog open={leave.dialogOpen} onClose={leave.stay} aria-labelledby="hall-leave-title" slotProps={{paper: {role: "alertdialog"}}}><DialogTitle id="hall-leave-title">Unsaved booking changes</DialogTitle><DialogContent>Your booking changes have not been saved.</DialogContent><DialogActions><Button autoFocus disabled={saving} onClick={leave.stay}>Stay</Button><Button disabled={saving} onClick={leave.continueWithoutSaving}>Discard</Button><Button disabled={saving} onClick={() => void leave.saveAndContinue()}>Save</Button></DialogActions></Dialog>
  </Paper>;
}
