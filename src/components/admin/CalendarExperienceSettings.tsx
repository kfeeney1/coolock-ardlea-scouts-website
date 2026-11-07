import { Alert, FormControlLabel, Paper, Switch, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { saveCalendarExperience, watchCalendarExperience, type CalendarExperienceVersion } from "../../services/calendarExperienceSettings";

export default function CalendarExperienceSettings() {
  const [version, setVersion] = useState<CalendarExperienceVersion | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => watchCalendarExperience(setVersion, () => {
    setVersion(null);
    setError("Unable to load Calendar settings. Reload to retry.");
  }), []);
  const save = async (next: CalendarExperienceVersion) => {
    if (!version || inFlight.current || next === version) return;
    inFlight.current = true;
    setSaving(true); setError(""); setSaved(false);
    try { await saveCalendarExperience(next, version); setSaved(true); }
    catch (failure) { setError(applicationErrorMessage(failure, "Unable to save Calendar settings.", "CalendarExperienceSettings")); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <Paper variant="outlined" sx={{ p: 3, maxWidth: 760, mt: 3 }}>
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success" role="status">Calendar setting saved. Canonical records are preserved.</Alert>}
    {!version && !error && <Typography>Loading Calendar setting…</Typography>}
    <FormControlLabel label="Group Calendar" control={
      <Switch color="secondary" checked={version === "redesigned"} disabled={!version || saving}
        onChange={event => void save(event.target.checked ? "redesigned" : "existing")}
        slotProps={{ input: { role: "switch" } }} sx={{ minHeight: 44 }} />
    } />
    {saving && <Typography role="status">Saving Calendar setting…</Typography>}
  </Paper>;
}
