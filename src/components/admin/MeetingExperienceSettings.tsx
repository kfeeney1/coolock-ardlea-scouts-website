import { Alert, FormControlLabel, Paper, Switch } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { saveMeetingExperience, watchMeetingExperience, type MeetingExperienceVersion } from "../../services/meetingExperienceSettings";

export default function MeetingExperienceSettings() {
  const [version, setVersion] = useState<MeetingExperienceVersion | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => watchMeetingExperience(setVersion, () => {
    setVersion(null); setError("Unable to load meeting workflow settings. Reload to retry.");
  }), []);
  const save = async (enabled: boolean) => {
    if (!version || inFlight.current) return;
    inFlight.current = true; setSaving(true); setError(""); setSaved(false);
    try { await saveMeetingExperience(enabled ? "redesigned" : "existing", version); setSaved(true); }
    catch (failure) { setError(applicationErrorMessage(failure, "Unable to save meeting workflow settings.", "MeetingExperienceSettings")); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <Paper aria-busy={saving} variant="outlined" sx={{ p: 3, maxWidth: 760, mt: 3, borderRadius: 2 }}>
    <FormControlLabel label="Plan, Run and Review meeting workflow" control={<Switch color="secondary" checked={version === "redesigned"} disabled={!version || saving} onChange={event => void save(event.target.checked)} slotProps={{ input: { role: "switch" } }} sx={{ minHeight: 44 }} />} />
    {saving && <Alert severity="info" role="status">Saving meeting workflow setting…</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success" role="status">Meeting workflow setting saved.</Alert>}
  </Paper>;
}
