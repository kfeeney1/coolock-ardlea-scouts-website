import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { saveMaintenanceExperience, watchMaintenanceExperience, type MaintenanceExperienceVersion } from "../../services/maintenanceExperienceSettings";

export default function MaintenanceExperienceSettings() {
  const [version, setVersion] = useState<MaintenanceExperienceVersion | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => watchMaintenanceExperience(setVersion, () => {
    setVersion(null);
    setError("Unable to load Maintenance settings. Reload to retry.");
  }), []);
  const save = async (next: MaintenanceExperienceVersion) => {
    if (!version || inFlight.current || next === version) return;
    inFlight.current = true;
    setSaving(true); setError(""); setSaved(false);
    try { await saveMaintenanceExperience(next, version); setSaved(true); }
    catch (failure) { setError(applicationErrorMessage(failure, "Unable to save Maintenance settings.", "MaintenanceExperienceSettings")); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <Paper variant="outlined" sx={{ p: 3, maxWidth: 760, mt: 3 }}>
    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Maintenance</Typography>
    <Typography sx={{ my: 2 }}>Enable group maintenance tasks and documents. Disabled by default. This setting is independent of navigation, schedules and attendance. Disabling retains all records.</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success" role="status">Maintenance setting saved. Existing tasks and documents are retained.</Alert>}
    {!version && !error && <Typography>Loading Maintenance setting…</Typography>}
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
      {(["existing", "redesigned"] as const).map((option) => <Button key={option} aria-pressed={version === option} variant={version === option ? "contained" : "outlined"} disabled={!version || saving} onClick={() => void save(option)} sx={{ minHeight: 44 }}>{option === "existing" ? "Maintenance disabled" : "Maintenance enabled"}</Button>)}
    </Stack>
  </Paper>;
}
