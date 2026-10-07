import { Box, Button, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from "@mui/material";
import { newBadgeworkPlan } from "../../services/weeklyTracker";
import type { WeeklyBadgeworkPlan, WeeklyLeaderOption, WeeklyMeetingRecord } from "../../services/weeklyTracker";
import { joinWeeklyLeaders, nonNegativeWeeklyNumber, splitWeeklyLeaders } from "../../services/weeklyTrackerLogic";

const ALL_LEADERS = "All leaders";
const LEADER_SEPARATOR = " | ";

interface WeeklyBadgeworkPlanEditorProps {
  meeting: WeeklyMeetingRecord;
  sectionLeaders: WeeklyLeaderOption[];
  readOnly: boolean;
  onPatch: (patch: Partial<WeeklyMeetingRecord>) => void;
}

export default function WeeklyBadgeworkPlanEditor({ meeting, sectionLeaders, readOnly, onPatch }: WeeklyBadgeworkPlanEditorProps) {
  const updateBadgework = (id: string, patch: Partial<WeeklyBadgeworkPlan>) =>
    onPatch({ badgeworkPlan: meeting.badgeworkPlan.map((item) => item.id === id ? { ...item, ...patch } : item) });

  const toggleLeader = (badgework: WeeklyBadgeworkPlan, name: string, checked: boolean) => {
    if (name === ALL_LEADERS) {
      updateBadgework(badgework.id, { leader: checked ? ALL_LEADERS : "" });
      return;
    }
    const current = splitWeeklyLeaders(badgework.leader).filter((value) => value !== ALL_LEADERS);
    updateBadgework(badgework.id, { leader: joinWeeklyLeaders(checked ? [...current, name] : current.filter((value) => value !== name)) });
  };

  return <Stack spacing={1.25}>
    {meeting.badgeworkPlan.map((item, index) => {
      const parts = splitWeeklyLeaders(item.leader);
      const knownNames = new Set(sectionLeaders.map((leader) => leader.displayName));
      const customLeaders = parts.filter((value) => value !== ALL_LEADERS && !knownNames.has(value));
      return <Paper key={item.id} variant="outlined" sx={{ p: { xs: 1.25, sm: 1.5 }, minWidth: 0 }} data-testid="badgework-plan-row">
        <Stack spacing={1.25}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
            <Typography sx={{ fontWeight: 800 }}>Badgework {index + 1}</Typography>
            {!readOnly && <Button size="small" sx={{ alignSelf: { xs: "stretch", sm: "auto" } }} onClick={() => onPatch({ badgeworkPlan: meeting.badgeworkPlan.filter((badgework) => badgework.id !== item.id) })}>Remove</Button>}
          </Stack>
          <TextField label={`Badgework ${index + 1}`} value={item.badge} disabled={readOnly} onChange={(event) => updateBadgework(item.id, { badge: event.target.value })} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,1fr) minmax(0,1fr)" }, gap: 1.25, minWidth: 0 }}>
            <Paper variant="outlined" sx={{ p: 1.25, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, mb: .5 }}>Badgework leaders {index + 1}</Typography>
              <FormControlLabel control={<Checkbox disabled={readOnly} checked={item.leader === ALL_LEADERS} onChange={(event) => toggleLeader(item, ALL_LEADERS, event.target.checked)} />} label="All leaders" />
              <Stack>{sectionLeaders.map((leader) => <FormControlLabel key={leader.id} control={<Checkbox disabled={readOnly || item.leader === ALL_LEADERS} checked={parts.includes(leader.displayName)} onChange={(event) => toggleLeader(item, leader.displayName, event.target.checked)} />} label={`${leader.displayName} · ${leader.scoutingRole}`} />)}</Stack>
              <TextField fullWidth size="small" label="Other badgework leader(s)" helperText="Separate multiple guest leaders with |" value={customLeaders.join(LEADER_SEPARATOR)} disabled={readOnly || item.leader === ALL_LEADERS} onChange={(event) => {
                const known = parts.filter((value) => knownNames.has(value));
                const custom = event.target.value.split("|").map((value) => value.trim()).filter(Boolean);
                updateBadgework(item.id, { leader: joinWeeklyLeaders([...known, ...custom]) });
              }} />
            </Paper>
            <Stack spacing={1.25}>
              <TextField label={`Badgework equipment ${index + 1}`} value={item.equipment} disabled={readOnly} onChange={(event) => updateBadgework(item.id, { equipment: event.target.value })} />
              <TextField label={`Badgework duration (minutes) ${index + 1}`} type="number" value={item.durationMinutes || ""} disabled={readOnly} onChange={(event) => updateBadgework(item.id, { durationMinutes: nonNegativeWeeklyNumber(event.target.value) })} slotProps={{ htmlInput: { min: 0, max: 360 } }} />
            </Stack>
          </Box>
          <TextField multiline minRows={2} label={`Badgework instructions / notes ${index + 1}`} value={item.notes} disabled={readOnly} onChange={(event) => updateBadgework(item.id, { notes: event.target.value })} />
        </Stack>
      </Paper>;
    })}
    {!readOnly && <Button variant="outlined" fullWidth onClick={() => onPatch({ badgeworkPlan: [...meeting.badgeworkPlan, newBadgeworkPlan()] })}>Add badgework</Button>}
  </Stack>;
}
