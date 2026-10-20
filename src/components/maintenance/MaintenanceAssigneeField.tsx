import { Alert, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { maintenanceTasks } from "../../services/maintenanceApi";
type Leader = {uid: string; displayName: string; groupLeader: boolean};
export default function MaintenanceAssigneeField({value, onChange, disabled}: {value: string; onChange: (value: string) => void; disabled: boolean}) {
  const [leaders, setLeaders] = useState<Leader[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { void maintenanceTasks<{leaders: Leader[]}>({action: "leaders"}).then(result => setLeaders(result.leaders)).catch(() => setFailed(true)); }, []);
  const defaults = leaders?.filter(leader => leader.groupLeader).length;
  return <Stack spacing={1}>
    {!leaders && !failed && <Typography role="status">Loading eligible leaders…</Typography>}
    {failed && <Alert severity="error">Unable to load leader choices. Reload before selecting a different leader.</Alert>}
    {leaders && defaults !== 1 && <Alert severity="warning">There is no single eligible Group Leader. Select a responsible leader explicitly.</Alert>}
    <TextField select label="Responsible leader" value={value} onChange={e => onChange(e.target.value)} disabled={disabled || !leaders} fullWidth>
      <MenuItem value="">Group Leader (automatic)</MenuItem>
      {value && !leaders?.some(leader => leader.uid === value) && <MenuItem value={value} disabled>{leaders ? "Current leader (no longer eligible)" : "Loading current leader…"}</MenuItem>}
      {leaders?.map(leader => <MenuItem key={leader.uid} value={leader.uid}>{leader.displayName}</MenuItem>)}
    </TextField>
  </Stack>;
}
