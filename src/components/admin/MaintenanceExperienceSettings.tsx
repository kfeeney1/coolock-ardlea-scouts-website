import { Alert, FormControlLabel, Paper, Switch, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { maintenanceAvailable, maintenanceCostHoldMessage } from "../../services/maintenanceRuntime";
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
    {!maintenanceAvailable && <Alert severity="info">{maintenanceCostHoldMessage}</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success" role="status">Maintenance setting saved. Existing tasks and documents are retained.</Alert>}
    {!version && !error && <Typography>Loading Maintenance setting…</Typography>}
    <FormControlLabel label="Maintenance" control={
      <Switch color="secondary" checked={version === "redesigned"} disabled={!version || saving || !maintenanceAvailable}
        onChange={event => void save(event.target.checked ? "redesigned" : "existing")}
        slotProps={{ input: { role: "switch" } }} sx={{ minHeight: 44 }} />
    } />
    {saving && <Typography role="status">Saving Maintenance setting…</Typography>}
  </Paper>;
}
