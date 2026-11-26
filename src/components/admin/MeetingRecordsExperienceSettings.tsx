import FeatureSettingSwitch from "./FeatureSettingSwitch";
import { Alert, Paper, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { saveMeetingRecordsExperience, watchMeetingRecordsExperience, type MeetingRecordsExperienceVersion } from "../../services/meetingRecordsExperienceSettings";

export default function MeetingRecordsExperienceSettings() {
  const [version, setVersion] = useState<MeetingRecordsExperienceVersion | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => watchMeetingRecordsExperience(setVersion, () => {
    setVersion(null);
    setError("Unable to load Meeting Records layout settings. Reload to retry.");
  }), []);
  const save = async (next: MeetingRecordsExperienceVersion) => {
    if (!version || inFlight.current || next === version) return;
    inFlight.current = true;
    setSaving(true); setError(""); setSaved(false);
    try { await saveMeetingRecordsExperience(next, version); setSaved(true); }
    catch (failure) { setError(applicationErrorMessage(failure, "Unable to save Meeting Records layout settings.", "MeetingRecordsExperienceSettings")); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, maxWidth: 760, mt: 3 }}>
    {error && <Alert severity="error">{error}</Alert>}
    {saved && <Alert severity="success" role="status">Meeting Records layout setting saved.</Alert>}
    {!version && !error && <Typography>Loading Meeting Records layout setting…</Typography>}
    <FeatureSettingSwitch
      label="Redesigned Meeting Records"
      checked={version === "redesigned"}
      disabled={!version || saving}
      onChange={enabled => void save(enabled ? "redesigned" : "existing")}
    />
    {saving && <Typography role="status">Saving Meeting Records layout setting…</Typography>}
  </Paper>;
}
