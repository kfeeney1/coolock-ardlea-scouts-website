import FeatureSettingSwitch from "./FeatureSettingSwitch";
import { Alert, Paper } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { saveScheduleExperience, watchScheduleExperience, type ScheduleExperienceVersion } from "../../services/scheduleExperienceSettings";

export default function ScheduleExperienceSettings() {
  const [version, setVersion] = useState<ScheduleExperienceVersion | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => watchScheduleExperience(setVersion, () => {
    setVersion(null);
    setError("Unable to load schedules settings. Reload to retry.");
  }), []);
  const save = async (next: ScheduleExperienceVersion) => {
    if (!version || inFlight.current || next === version) return;
    inFlight.current = true;
    setSaving(true); setError(""); setSaved(false);
    try { await saveScheduleExperience(next, version); setSaved(true); }
    catch (failure) { setError(applicationErrorMessage(failure, "Unable to save schedules settings.", "ScheduleExperienceSettings")); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <Paper aria-busy={saving} variant="outlined" sx={{ p: { xs: 2, md: 3 }, maxWidth: 760, mt: 3, borderRadius: 2 }}>
    <FeatureSettingSwitch
      label="Redesigned schedules"
      checked={version === "redesigned"}
      disabled={!version || saving}
      onChange={enabled => void save(enabled ? "redesigned" : "existing")}
    />
    {!version && !error && <Alert severity="info" role="status">Loading schedules setting…</Alert>}
    {saving && <Alert severity="info" role="status">Saving schedules setting…</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success" role="status">Schedule setting saved.</Alert>}
  </Paper>;
}
