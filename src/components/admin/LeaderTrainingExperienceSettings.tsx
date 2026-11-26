import FeatureSettingSwitch from "./FeatureSettingSwitch";
import { Alert, Paper } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { saveLeaderTrainingExperience, watchLeaderTrainingExperience, type LeaderTrainingExperienceVersion } from "../../services/leaderTrainingExperienceSettings";

export default function LeaderTrainingExperienceSettings() {
  const [version, setVersion] = useState<LeaderTrainingExperienceVersion | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => watchLeaderTrainingExperience(setVersion, () => {
    setVersion(null); setError("Unable to load leader training settings. Reload to retry.");
  }), []);
  const save = async (enabled: boolean) => {
    if (!version || inFlight.current) return;
    inFlight.current = true; setSaving(true); setError(""); setSaved(false);
    try { await saveLeaderTrainingExperience(enabled ? "redesigned" : "existing", version); setSaved(true); }
    catch (failure) { setError(applicationErrorMessage(failure, "Unable to save leader training settings.", "LeaderTrainingExperienceSettings")); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, maxWidth: 760, mt: 3, borderRadius: 2 }}>
    <FeatureSettingSwitch
      label="Leader training & vetting"
      checked={version === "redesigned"}
      disabled={!version || saving}
      onChange={enabled => void save(enabled)}
    />
    {!version && !error && <Alert severity="info" role="status">Loading setting…</Alert>}
    {saving && <Alert severity="info" role="status">Saving leader training setting…</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success" role="status">Leader training setting saved.</Alert>}
  </Paper>;
}
