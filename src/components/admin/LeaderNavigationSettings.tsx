import { Alert, FormControlLabel, Paper, Switch } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { saveLeaderNavigation, watchLeaderNavigation, type LeaderNavigationVersion } from "../../services/leaderNavigationSettings";

export default function LeaderNavigationSettings() {
  const [version, setVersion] = useState<LeaderNavigationVersion | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => watchLeaderNavigation(setVersion, () => {
    setVersion(null);
    setError("Unable to load navigation settings. Reload to retry.");
  }), []);
  const save = async (next: LeaderNavigationVersion) => {
    if (!version || inFlight.current || next === version) return;
    inFlight.current = true;
    setSaving(true); setError(""); setSaved(false);
    try { await saveLeaderNavigation(next, version); setSaved(true); }
    catch (failure) { setError(applicationErrorMessage(failure, "Unable to save navigation settings.", "LeaderNavigationSettings")); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <Paper aria-busy={saving} variant="outlined" sx={{ p: 3, maxWidth: 760, mt: 3, borderRadius: 2 }}>
    <FormControlLabel
      label="Redesigned navigation"
      control={<Switch
        color="secondary"
        checked={version === "redesigned"}
        disabled={!version || saving}
        onChange={event => void save(event.target.checked ? "redesigned" : "existing")}
        slotProps={{ input: { role: "switch" } }}
        sx={{ minHeight: 44 }}
      />}
    />
    {!version && !error && <Alert severity="info" role="status">Loading navigation setting…</Alert>}
    {saving && <Alert severity="info" role="status">Saving navigation setting…</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success" role="status">Navigation setting saved.</Alert>}
  </Paper>;
}
