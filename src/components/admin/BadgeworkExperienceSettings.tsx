import { Alert, Button, FormControlLabel, Paper, Switch } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { saveBadgeworkExperience, watchBadgeworkExperience, type BadgeworkExperienceVersion } from "../../services/badgeworkExperienceSettings";

export default function BadgeworkExperienceSettings() {
  const [version, setVersion] = useState<BadgeworkExperienceVersion | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    return watchBadgeworkExperience(setVersion, () => {
      setVersion(null); setLoadFailed(true); setError("Unable to load badgework settings.");
    });
  }, [loadAttempt]);
  const save = async (enabled: boolean) => {
    if (!version || inFlight.current) return;
    inFlight.current = true; setSaving(true); setError(""); setSaved(false);
    try { await saveBadgeworkExperience(enabled ? "redesigned" : "existing", version); setSaved(true); }
    catch (failure) { setError(applicationErrorMessage(failure, "Unable to save badgework settings.", "BadgeworkExperienceSettings")); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <Paper aria-busy={saving} variant="outlined" sx={{ p: { xs: 2, md: 3 }, maxWidth: 760, mt: 3, borderRadius: 2 }}>
    <FormControlLabel label="Badgework redesign" control={<Switch color="secondary" checked={version === "redesigned"} disabled={!version || saving} onChange={event => void save(event.target.checked)} slotProps={{ input: { role: "switch" } }} sx={{ minHeight: 44 }} />} />
    {saving && <Alert severity="info" role="status">Saving badgework setting…</Alert>}
    {error && <Alert severity="error" action={loadFailed ? <Button color="inherit" onClick={() => { setLoadFailed(false); setError(""); setSaved(false); setLoadAttempt(value => value + 1); }} sx={{ minHeight: 44 }}>Retry</Button> : undefined}>{error}</Alert>}
    {saved && <Alert severity="success" role="status">Badgework setting saved.</Alert>}
  </Paper>;
}
