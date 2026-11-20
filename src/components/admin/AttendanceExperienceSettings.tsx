import { Alert, Button, FormControlLabel, Paper, Stack, Switch, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { saveAttendanceExperience, watchAttendanceExperience, type AttendanceExperienceVersion } from "../../services/attendanceExperienceSettings";

export default function AttendanceExperienceSettings({ reports = false }: { reports?: boolean }) {
  const experience = reports ? "reportsExperience" : "attendanceExperience";
  const label = reports ? "Reports" : "Attendance Insights";
  const [version, setVersion] = useState<AttendanceExperienceVersion | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => watchAttendanceExperience(setVersion, () => {
    setVersion(null);
    setError(`Unable to load ${label} settings. Reload to retry.`);
  }, experience), [experience, label]);
  const save = async (next: AttendanceExperienceVersion) => {
    if (!version || inFlight.current || next === version) return;
    inFlight.current = true;
    setSaving(true); setError(""); setSaved(false);
    try { await saveAttendanceExperience(next, version, experience); setSaved(true); }
    catch (failure) { setError(applicationErrorMessage(failure, `Unable to save ${label} settings.`, "AttendanceExperienceSettings")); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <Paper variant="outlined" sx={{ p: 3, maxWidth: 760, mt: 3 }}>
    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>{label} experience</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success" role="status">{label} experience saved.</Alert>}
    {!version && !error && <Typography>Loading {label} setting…</Typography>}
    {reports ? <FormControlLabel label="Redesigned Reports menu and landing page" control={<Switch checked={version === "redesigned"} disabled={!version || saving} onChange={(_, checked) => void save(checked ? "redesigned" : "existing")} />} /> : <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
      {(["existing", "redesigned"] as const).map((option) => <Button key={option} aria-pressed={version === option} variant={version === option ? "contained" : "outlined"} disabled={!version || saving} onClick={() => void save(option)} sx={{ minHeight: 44 }}>{option === "existing" ? "Existing attendance" : "Attendance matrix"}</Button>)}
    </Stack>}
  </Paper>;
}
