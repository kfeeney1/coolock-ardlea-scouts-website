import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
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
  return <Paper variant="outlined" sx={{ p: 3, maxWidth: 760, mt: 3 }}>
    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Weekly Meetings and Events experience</Typography>
    <Typography sx={{ my: 2 }}>Choose one experience for both Weekly Meetings and Events. Existing is the default. Changes apply live across sessions; no refresh is required. This is independent of leader navigation.</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success" role="status">Schedule experience saved. This setting does not change meeting or event records.</Alert>}
    {!version && !error && <Typography>Loading schedules setting…</Typography>}
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
      {(["existing", "redesigned"] as const).map((option) => <Button key={option} aria-pressed={version === option} variant={version === option ? "contained" : "outlined"} disabled={!version || saving} onClick={() => void save(option)} sx={{ minHeight: 44 }}>{option === "existing" ? "Existing schedules" : "Redesigned schedules"}</Button>)}
    </Stack>
  </Paper>;
}
