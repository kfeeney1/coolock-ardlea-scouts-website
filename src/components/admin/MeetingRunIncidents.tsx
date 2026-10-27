import { Alert, Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import type { WeeklyMeetingDetailsProps } from "./WeeklyMeetingDetailsPanels";
import type { InjurySeverity } from "../../services/weeklyTracker";
import { incidentFromDraft } from "../../services/meetingIncidentDraft";
export default function MeetingRunIncidents(p: WeeklyMeetingDetailsProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const add = () => {
    try {
      const injury = incidentFromDraft(p.selected, { memberId: p.injuryMemberId, concern: p.injuryConcern, severity: p.injurySeverity, action: p.injuryAction, parentInformed: p.injuryParentInformed });
      p.patch({ injuries: [...p.selected.injuries, injury] });
      p.setInjuryMemberId(""); p.setInjuryConcern(""); p.setInjurySeverity("minor"); p.setInjuryAction(""); p.setInjuryParentInformed(false);
      setError(""); setMessage("Incident added to meeting draft. Check the meeting save state above for saved confirmation.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to add incident. Your form is retained."); }
  };
  return <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}><Stack spacing={1.5}>
    <Typography component="h3" variant="h5" sx={{ fontWeight: 800 }}>Injuries / Medical Issues</Typography>
    {!p.selected.injuries.length && <Typography color="text.secondary">No incidents recorded in this meeting.</Typography>}
    {p.selected.injuries.map((injury, index) => <Alert key={`${injury.recordedAt}-${index}`} severity={injury.severity === "serious" ? "error" : injury.severity === "moderate" ? "warning" : "info"} sx={{ overflowWrap: "anywhere" }}><Typography>{injury.memberName}: {injury.concern}</Typography><Typography>{injury.severity} · {injury.actionTaken || "No action recorded"} · Parent {injury.parentInformed ? "informed" : "not informed"}</Typography><Typography variant="body2">Recorded: {injury.recordedAt.slice(0, 10).split("-").reverse().join("-")} {injury.recordedAt.slice(11, 16)} UTC</Typography></Alert>)}
    {message && <Alert severity="info" role="status">{message}</Alert>}{error && <Alert severity="error">{error}</Alert>}
    {!p.operationalReadOnly && <>
      <Typography color="text.secondary">Add the incident to the draft, or use Save to save the meeting including the entered incident. Leaving an unfinished form requires Save, Discard or Stay.</Typography>
      <TextField select label="Incident member" required value={p.injuryMemberId} onChange={e => p.setInjuryMemberId(e.target.value)}>{p.selected.entries.map(entry => <MenuItem key={entry.memberId} value={entry.memberId}>{entry.memberName}</MenuItem>)}</TextField>
      <TextField label="Injury / medical concern" required multiline value={p.injuryConcern} onChange={e => p.setInjuryConcern(e.target.value)} />
      <TextField select label="Severity" value={p.injurySeverity} onChange={e => p.setInjurySeverity(e.target.value as InjurySeverity)}><MenuItem value="minor">Minor</MenuItem><MenuItem value="moderate">Moderate</MenuItem><MenuItem value="serious">Serious</MenuItem></TextField>
      <TextField label="Action taken" multiline value={p.injuryAction} onChange={e => p.setInjuryAction(e.target.value)} />
      <FormControlLabel control={<Checkbox sx={{ minWidth: 44, minHeight: 44 }} checked={p.injuryParentInformed} onChange={e => p.setInjuryParentInformed(e.target.checked)} />} label="Parent informed" />
      <Button variant="outlined" sx={{ minHeight: 44 }} onClick={add}>Add incident to draft</Button>
    </>}
  </Stack></Paper>;
}
