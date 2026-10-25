import { Alert, FormControlLabel, Switch, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { useRef, useState } from "react";
import DatePickerField from "../DatePickerField";
import { useConfirmEventLeave } from "../../hooks/useConfirmEventLeave";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { focusFirstInvalidFieldAfterRender } from "../../services/formValidationFocus";
import { saveLeaderTraining } from "../../services/leaderTraining";
import { trainingDatesError, trainingLabels, type LeaderTrainingRecord, type TrainingCategory, type TrainingDates } from "../../services/leaderTrainingLogic";

export default function LeaderTrainingEditor({ leaderUid, category, initial, renewal, onSaved, onCancel }: {
  leaderUid: string; category: TrainingCategory; initial?: LeaderTrainingRecord; renewal: boolean; onSaved: () => void; onCancel: () => void;
}) {
  const [baseline] = useState<TrainingDates>(() => ({ completedDate: initial?.completedDate || "", expiryDate: initial?.expiryDate || "", showOnCalendar: initial?.showOnCalendar === true }));
  const [form, setForm] = useState(baseline);
  const [invalid, setInvalid] = useState({ completedDate: false, expiryDate: false });
  const [error, setError] = useState("");
  const [validation, setValidation] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const lock = useRef(false);
  const root = useRef<HTMLFormElement>(null);
  const dirty = Object.values(invalid).some(Boolean) || JSON.stringify(form) !== JSON.stringify(baseline);
  const save = async () => {
    if (lock.current) return false;
    const message = Object.values(invalid).some(Boolean) ? "Enter real dates as DD-MM-YYYY." : trainingDatesError(form);
    setValidation(message); setError("");
    if (message) { focusFirstInvalidFieldAfterRender(root.current || document); return false; }
    lock.current = true; setSaving(true);
    try { await saveLeaderTraining(leaderUid, category, form, initial?.revision || 0); return true; }
    catch (cause) { setError(applicationErrorMessage(cause, "Unable to save training dates. Your changes have been retained. Try again.", "LeaderTrainingEditor")); return false; }
    finally { lock.current = false; setSaving(false); }
  };
  const leave = useConfirmEventLeave(dirty, save);
  const saveAndClose = async () => { if (await save()) { leave.releaseAfterSuccessfulSave(); onSaved(); } };
  const cancel = () => { leave.releaseAfterSuccessfulSave(); onCancel(); };
  return <Stack ref={root} component="form" noValidate spacing={2} onSubmit={event => { event.preventDefault(); void saveAndClose(); }} sx={{ mt: 2, p: 2, border: 1, borderColor: "divider", borderRadius: 2 }} aria-label={`${trainingLabels[category]} dates`}>
    <Typography component="h3" variant="h6">{renewal ? "Record renewal" : "Edit record"} · {trainingLabels[category]}</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {validation && <Alert severity="error">{validation}</Alert>}
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      {([['completedDate', 'Completion / issue date'], ['expiryDate', 'Expiry / lapse date']] as const).map(([field, label]) => <DatePickerField key={field} fullWidth autoFocus={field === "completedDate"} name={field} label={label} value={form[field]} disabled={saving} onChange={event => { setForm(previous => ({ ...previous, [field]: event.target.value })); setInvalid(previous => ({ ...previous, [field]: false })); }} onInputValidityChange={valid => { const input = root.current?.elements.namedItem(field) as HTMLInputElement | null; setInvalid(previous => ({ ...previous, [field]: !valid && Boolean(input?.value.trim()) })); }} error={invalid[field] || Boolean(validation)} helperText={invalid[field] ? "Enter a real date as DD-MM-YYYY." : validation || " "} />)}
    </Stack>
    <FormControlLabel sx={{ minHeight: 44 }} control={<Switch checked={form.showOnCalendar === true} disabled={saving} onChange={event => setForm(previous => ({ ...previous, showOnCalendar: event.target.checked }))} />} label="Show renewal on group calendar" />
    <Stack direction="row" spacing={1}><Button type="submit" variant="contained" color="secondary" disabled={saving} sx={{ minHeight: 44 }}>{saving ? "Saving…" : "Save record"}</Button><Button disabled={saving} onClick={() => dirty ? setCancelOpen(true) : cancel()} sx={{ minHeight: 44 }}>Cancel</Button></Stack>
    <Dialog open={cancelOpen || leave.dialogOpen} onClose={() => { setCancelOpen(false); leave.stay(); }} aria-labelledby="training-unsaved-title" fullWidth maxWidth="xs">
      <DialogTitle id="training-unsaved-title">Unsaved training changes</DialogTitle>
      <DialogContent><Typography>Save your dates, discard your changes, or stay in the editor.</Typography></DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", "& .MuiButton-root": { minHeight: 44 } }}><Button autoFocus disabled={saving} onClick={() => { setCancelOpen(false); leave.stay(); }}>Stay</Button><Button color="error" disabled={saving} onClick={() => cancelOpen ? cancel() : leave.continueWithoutSaving()}>Discard</Button><Button disabled={saving} onClick={() => void (cancelOpen ? saveAndClose() : leave.saveAndContinue())}>Save</Button></DialogActions>
    </Dialog>
  </Stack>;
}
