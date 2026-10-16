import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
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
  return <Paper variant="outlined" sx={{ p: 3, maxWidth: 760, mt: 3 }}>
    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Leader Dashboard navigation</Typography>
    <Typography sx={{ my: 2 }}>Choose the navigation used by everyone in this group. Existing navigation is the default.</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success" role="status">Navigation saved. The selected version applies across sessions.</Alert>}
    {!version && !error && <Typography>Loading navigation setting…</Typography>}
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
      {(["existing", "redesigned"] as const).map((option) => <Button key={option} aria-pressed={version === option} variant={version === option ? "contained" : "outlined"} disabled={!version || saving} onClick={() => void save(option)} sx={{ minHeight: 44 }}>{option === "existing" ? "Existing navigation" : "Redesigned navigation"}</Button>)}
    </Stack>
  </Paper>;
}
