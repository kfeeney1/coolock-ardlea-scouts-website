import { MenuItem, TextField } from "@mui/material";
import type { MaintenanceLeader } from "../../services/maintenanceAssignmentPolicy";
export default function MaintenanceAssigneeField({leaders, value, onChange, disabled}: {leaders: MaintenanceLeader[]; value: string; onChange: (value: string) => void; disabled: boolean}) {
  const defaults = leaders.filter(item => item.groupLeader);
  return <TextField select label="Responsible leader" value={value} onChange={event => onChange(event.target.value)} disabled={disabled} helperText={!value && defaults.length !== 1 ? "There is no single eligible Group Leader. Select a leader explicitly." : "Leave unselected to use the current Group Leader."}>
    <MenuItem value="" sx={{minHeight: 44}}>Default to Group Leader</MenuItem>
    {value && !leaders.some(item => item.uid === value) && <MenuItem value={value} disabled>Previous leader is no longer eligible</MenuItem>}
    {leaders.map(item => <MenuItem key={item.uid} value={item.uid} sx={{minHeight: 44, whiteSpace: "normal", overflowWrap: "anywhere"}}>{item.displayName}{item.groupLeader ? " · Group Leader" : ""}</MenuItem>)}
  </TextField>;
}
