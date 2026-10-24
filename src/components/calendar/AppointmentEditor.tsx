import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DatePickerField from "../DatePickerField";
import { useConfirmEventLeave } from "../../hooks/useConfirmEventLeave";
import { appointmentErrors, appointmentSavedPath, type AppointmentErrors, type AppointmentInput, cleanAppointment } from "../../services/maintenanceAppointmentLogic";
import { saveMaintenanceAppointment } from "../../services/maintenanceAppointmentStore";
import { focusFirstInvalidFieldAfterRender } from "../../services/formValidationFocus";
import { applicationErrorMessage } from "../../services/applicationErrors";
export default function AppointmentEditor({id, initial, revision, back, taskId = "", preserveReturn = false}: {id: string; initial: AppointmentInput; revision: number; back: string; taskId?: string; preserveReturn?: boolean}) {
  const navigate = useNavigate();
  const [baseline] = useState(() => ({input: cleanAppointment(initial), revision}));
  const [form, setForm] = useState(baseline.input), [invalidDate, setInvalidDate] = useState(false);
  const [errors, setErrors] = useState<AppointmentErrors>({}), [error, setError] = useState("");
  const [saving, setSaving] = useState(false); const lock = useRef(false), root = useRef<HTMLFormElement>(null);
  const dirty = invalidDate || JSON.stringify(form) !== JSON.stringify(baseline.input);
  const set = <K extends keyof AppointmentInput>(key: K, value: AppointmentInput[K]) => {setForm(previous => ({...previous, [key]: value})); setErrors(previous => ({...previous, [key]: undefined}));};
  const save = async () => {
    if (lock.current) return false;
    const validation = appointmentErrors({...form, title: taskId ? "Linked task" : form.title});
    if (invalidDate) validation.date = "Enter a real date as DD-MM-YYYY.";
    setErrors(validation); setError("");
    if (Object.keys(validation).length) {setError("Please correct the highlighted fields before saving."); focusFirstInvalidFieldAfterRender(root.current || document); return false;}
    lock.current = true; setSaving(true);
    try {await saveMaintenanceAppointment(id, form, baseline.revision, taskId); return true;}
    catch (cause) {setError(applicationErrorMessage(cause, "Unable to save the appointment. Your details have been retained.", "AppointmentEditor")); return false;}
    finally {lock.current = false; setSaving(false);}
  };
  // Reuse the site's current Save / Discard / Stay and browser/Android Back guard.
  const leave = useConfirmEventLeave(dirty, save, request => {
    if (request.kind === "sign-out" || (request.kind === "navigate" && !request.destination.startsWith("/calendar"))) return false;
    navigate((preserveReturn ? back : appointmentSavedPath(back, form.date)), {replace: true, state: {calendarSaved: true}}); return true;
  });
  const saveAndReturn = async () => {if (await save()) {leave.releaseAfterSuccessfulSave(); navigate((preserveReturn ? back : appointmentSavedPath(back, form.date)), {replace: true, state: {calendarSaved: true}});}};
  const field = (key: "title" | "location" | "notes", label: string, maxLength: number, multiline = false) => <TextField fullWidth label={label} required={key === "title"} value={form[key]} onChange={event => set(key, event.target.value)} error={Boolean(errors[key])} helperText={errors[key]} slotProps={{htmlInput: {maxLength}}} multiline={multiline} minRows={multiline ? 4 : undefined} disabled={saving} />;
  return <Stack ref={root} component="form" noValidate spacing={2} onSubmit={event => {event.preventDefault(); void saveAndReturn();}}>
    <Typography component="h2" variant="h5" color="secondary" sx={{fontWeight: 800}}>{taskId ? revision ? "Reschedule task" : "Schedule task" : revision ? "Edit appointment" : "New service appointment"}</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {!taskId && field("title", "Appointment title", 200)}
    <DatePickerField onInputValidityChange={valid => setInvalidDate(!valid)} name="appointmentDate" label="Appointment date" value={form.date} onChange={event => {set("date", event.target.value); setInvalidDate(false);}} minDate="1900-01-01" maxDate="2199-12-31" required error={Boolean(errors.date)} helperText={errors.date} disabled={saving} />
    <FormControlLabel control={<Checkbox checked={form.allDay} onChange={(_, checked) => set("allDay", checked)} disabled={saving} />} label="All day" />
    {!form.allDay && <Stack direction={{xs: "column", sm: "row"}} spacing={2}>
      {([['startTime', 'Start time'], ['endTime', 'End time']] as const).map(([key, label]) => <TextField fullWidth key={key} type="time" label={label} value={form[key]} onChange={event => set(key, event.target.value)} required error={Boolean(errors[key])} helperText={errors[key]} slotProps={{inputLabel: {shrink: true}, htmlInput: {step: 60}}} disabled={saving} />)}
    </Stack>}
    <Typography variant="body2" color="text.secondary">Times are local Scout Group times (Europe/Dublin).</Typography>
    {field("location", "Location (optional)", 300)}{field("notes", "Notes (optional)", 8000, true)}
    <Stack direction="row" spacing={1} useFlexGap sx={{flexWrap: "wrap"}}><Button type="submit" variant="contained" color="secondary" disabled={saving} sx={{minHeight: 44, borderRadius: 2, boxShadow: "none"}}>{saving ? "Saving…" : "Save appointment"}</Button><Button component={Link} to={back} disabled={saving} sx={{minHeight: 44, borderRadius: 2, boxShadow: "none"}}>Cancel</Button></Stack>
    {saving && <Typography role="status">Saving appointment…</Typography>}
    <Dialog open={leave.dialogOpen} onClose={leave.stay} aria-labelledby="appointment-unsaved-title" aria-describedby="appointment-unsaved-description" slotProps={{paper: {role: "alertdialog"}}} fullWidth maxWidth="xs">
      <DialogTitle id="appointment-unsaved-title">Unsaved appointment changes</DialogTitle>
      <DialogContent><Typography id="appointment-unsaved-description">You have changes that have not been saved. Save them before leaving, discard them, or stay in the editor.</Typography></DialogContent>
      <DialogActions sx={{flexWrap: "wrap", "& .MuiButton-root": {minHeight: 44}}}><Button onClick={leave.stay} autoFocus disabled={saving}>Stay</Button><Button onClick={leave.continueWithoutSaving} color="error" disabled={saving}>Discard</Button><Button onClick={() => void leave.saveAndContinue()} disabled={saving}>Save</Button></DialogActions>
    </Dialog>
  </Stack>;
}
