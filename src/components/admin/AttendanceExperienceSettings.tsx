import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { saveAttendanceExperience, watchAttendanceExperience, type AttendanceExperienceVersion } from "../../services/attendanceExperienceSettings";

export default function AttendanceExperienceSettings() {
  const [version, setVersion] = useState<AttendanceExperienceVersion | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => watchAttendanceExperience(setVersion, () => {
    setVersion(null);
    setError("Unable to load attendance settings. Reload to retry.");
  }), []);
  const save = async (next: AttendanceExperienceVersion) => {
    if (!version || inFlight.current || next === version) return;
    inFlight.current = true;
    setSaving(true); setError(""); setSaved(false);
    try { await saveAttendanceExperience(next, version); setSaved(true); }
    catch (failure) { setError(applicationErrorMessage(failure, "Unable to save attendance settings.", "AttendanceExperienceSettings")); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <Paper variant="outlined" sx={{ p: 3, maxWidth: 760, mt: 3 }}>
    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Attendance Insights experience</Typography>
    <Typography sx={{ my: 2 }}>Choose the existing Attendance Insights or add the read-only attendance matrix alongside summaries. Existing is the default. Changes apply live across sessions and are independent of navigation and schedules.</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success" role="status">Attendance experience saved. This setting does not change attendance records.</Alert>}
    {!version && !error && <Typography>Loading attendance setting…</Typography>}
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
      {(["existing", "redesigned"] as const).map((option) => <Button key={option} aria-pressed={version === option} variant={version === option ? "contained" : "outlined"} disabled={!version || saving} onClick={() => void save(option)} sx={{ minHeight: 44 }}>{option === "existing" ? "Existing attendance" : "Attendance matrix"}</Button>)}
    </Stack>
  </Paper>;
}
