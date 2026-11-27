import FeatureSettingSwitch from "./FeatureSettingSwitch";
import { Alert, Paper, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { saveAttendanceExperience, watchAttendanceExperience, type AttendanceExperienceVersion, type ConfigurableExperience } from "../../services/attendanceExperienceSettings";

const experienceLabels = {
  attendanceExperience: { label: "Attendance Insights", switchLabel: "Attendance matrix" },
  reportsExperience: { label: "Reports", switchLabel: "Redesigned Reports menu and landing page" },
  eventEditExperience: { label: "Edit Event", switchLabel: "Redesigned Edit Event" },
  eventRecordExperience: { label: "Event Record", switchLabel: "Redesigned Event Record" }
} satisfies Record<ConfigurableExperience, { label: string; switchLabel: string }>;

export default function AttendanceExperienceSettings({ experience = "attendanceExperience" }: { experience?: ConfigurableExperience }) {
  const { label, switchLabel } = experienceLabels[experience];
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
      label={switchLabel}
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
