import { Alert, Button, FormControlLabel, Paper, Switch } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { saveHallHire, watchHallHireAdministration } from "../../services/hallHireSettings";

export default function HallHireSettings() {
  const [value, setValue] = useState<{enabled: boolean; ready: boolean} | null>(null);
  const [attempt, setAttempt] = useState(0), [error, setError] = useState("");
  const [saved, setSaved] = useState(false), [saving, setSaving] = useState(false), [loadFailed, setLoadFailed] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => watchHallHireAdministration(setValue, () => {setValue(null); setLoadFailed(true); setError("Unable to load Hall Hire settings.");}), [attempt]);
  const save = async (enabled: boolean) => {
    if (!value || inFlight.current || enabled === value.enabled) return;
    inFlight.current = true; setSaving(true); setSaved(false); setError("");
    try {await saveHallHire(enabled, value.enabled); setSaved(true);}
    catch (failure) {setError(applicationErrorMessage(failure, "Unable to save Hall Hire settings.", "HallHireSettings"));}
    finally {inFlight.current = false; setSaving(false);}
  };
  return <Paper variant="outlined" aria-busy={saving} sx={{p: {xs: 2, md: 3}, maxWidth: 760, mt: 3, borderRadius: 2}}>
    <FormControlLabel label="Hall Hire" control={<Switch color="secondary" checked={value?.enabled === true} disabled={!value || saving || (!value.ready && !value.enabled)} onChange={event => void save(event.target.checked)} slotProps={{input: {role: "switch"}}} sx={{minHeight: 44, "& .MuiSwitch-input:focus-visible + .MuiSwitch-thumb": {outline: "3px solid", outlineColor: "secondary.main", outlineOffset: 2}}} />} />
    {saving && <Alert severity="info" role="status">Saving Hall Hire setting…</Alert>}
    {saved && <Alert severity="success" role="status">Hall Hire setting saved.</Alert>}
    {error && <Alert severity="error" action={loadFailed ? <Button color="inherit" onClick={() => {setLoadFailed(false); setError(""); setSaved(false); setValue(null); setAttempt(value => value + 1);}}>Retry</Button> : undefined}>{error}</Alert>}
  </Paper>;
}
