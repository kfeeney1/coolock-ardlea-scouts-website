import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
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
    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Group Calendar</Typography>
    <Typography sx={{ my: 2 }}>Enable the monthly Group Calendar after live TEST acceptance. Disabled is the default. Calendar is independent of navigation, schedules, attendance and Maintenance. Maintenance entries also require Maintenance to be enabled and authorised.</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success" role="status">Calendar setting saved. Canonical records are preserved.</Alert>}
    {!version && !error && <Typography>Loading Calendar setting…</Typography>}
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
      {(["existing", "redesigned"] as const).map((option) => <Button key={option} aria-pressed={version === option} color={version === option ? "secondary" : "primary"} variant={version === option ? "contained" : "outlined"} disabled={!version || saving} onClick={() => void save(option)} sx={{ minHeight: 44 }}>{option === "existing" ? "Calendar disabled" : "Calendar enabled"}</Button>)}
    </Stack>
  </Paper>;
}
