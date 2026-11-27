import FeatureSettingSwitch from "./FeatureSettingSwitch";
import { Alert, Paper, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { saveAttendanceExperience, watchAttendanceExperience, type AttendanceExperienceVersion } from "../../services/attendanceExperienceSettings";

export default function AttendanceExperienceSettings({ reports = false, eventEdit = false }: { reports?: boolean; eventEdit?: boolean }) {
  const experience = eventEdit ? "eventEditExperience" : reports ? "reportsExperience" : "attendanceExperience";
  const label = eventEdit ? "Edit Event" : reports ? "Reports" : "Attendance Insights";
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
  return <Paper aria-busy={saving} variant="outlined" sx={{ p: { xs: 2, md: 3 }, maxWidth: 760, mt: 3, borderRadius: 2 }}>
    <FeatureSettingSwitch
      label={eventEdit ? "Redesigned Edit Event" : reports ? "Redesigned Reports menu and landing page" : "Attendance matrix"}
      checked={version === "redesigned"}
      disabled={!version || saving}
      onChange={enabled => void save(enabled ? "redesigned" : "existing")}
    />
    {!version && !error && <Typography role="status">Loading {label} setting…</Typography>}
    {saving && <Typography role="status">Saving {label} setting…</Typography>}
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success" role="status">{label} experience saved.</Alert>}
  </Paper>;
}
