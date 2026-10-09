import { Button, Checkbox, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Stack, Typography } from "@mui/material";
import type { WeeklyMemberEntry, WeeklyLeaderOption } from "../../services/weeklyTracker";
import type { LeaderAttendanceEntry } from "../../services/leaderAttendance";
import LeaderAttendanceSection from "./LeaderAttendanceSection";

type Props = {
  entries: WeeklyMemberEntry[];
  present: number;
  total: number;
  readOnly: boolean;
  onEntriesChange: (entries: WeeklyMemberEntry[]) => void;
  leaders: WeeklyLeaderOption[];
  leaderAttendance: LeaderAttendanceEntry[];
  onLeaderAttendanceChange: (entries: LeaderAttendanceEntry[]) => void;
  leaderAttendanceLoading: boolean;
};

export default function WeeklyMeetingAttendancePanel({ entries, present, total, readOnly, onEntriesChange, leaders, leaderAttendance, onLeaderAttendanceChange, leaderAttendanceLoading }: Props) {
  const update = (entry: WeeklyMemberEntry, patch: Partial<WeeklyMemberEntry>) => onEntriesChange(entries.map((item) => item.memberId === entry.memberId ? { ...item, ...patch } : item));
  return <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", mb: 2 }}><Typography variant="h5" sx={{ fontWeight: 800 }}>Attendance</Typography><Chip color="success" label={`${present}/${total} Present`} sx={{ alignSelf: { xs: "flex-start", sm: "center" } }} /></Stack>
    {!readOnly && <Button fullWidth variant="outlined" sx={{ mb: 2 }} onClick={() => onEntriesChange(entries.map((entry) => ({ ...entry, attendance: "present" })))}>Mark all present</Button>}
    <TableContainer data-testid="attendance-list" sx={{ overflowX: "hidden" }}><Table size="small" aria-label="Meeting attendance checklist" sx={{ tableLayout: "fixed", width: "100%"}}>
      <TableHead><TableRow><TableCell sx={{ width: "50%", px: { xs: 0.5, sm: 2 }, py: 0.75 }}>Member</TableCell><TableCell align="center" sx={{ width: "25%", px: { xs: 0.5, sm: 2 }, py: 0.75 }}>Attendance</TableCell><TableCell align="center" sx={{ width: "25%", px: { xs: 0.5, sm: 2 }, py: 0.75 }}>Uniform</TableCell></TableRow></TableHead>
      <TableBody>{entries.map((entry) => <TableRow key={entry.memberId}><TableCell component="th" scope="row" sx={{ overflowWrap: "anywhere", wordBreak: "break-word", px: { xs: 0.5, sm: 2 }, py: 0.5 }}>{entry.memberName}</TableCell>
        <TableCell align="center" sx={{ px: { xs: 0.5, sm: 2 }, py: 0.5 }}><Checkbox slotProps={{ input: { "aria-label": `Attendance · ${entry.memberName}` } }} disabled={readOnly} checked={entry.attendance === "present"} sx={{ minWidth: 44, minHeight: 44, p: 0.5 }} onChange={(event) => update(entry, { attendance: event.target.checked ? "present" : "absent", ...(!event.target.checked ? { uniform: false } : {}) })} /></TableCell>
        <TableCell align="center" sx={{ px: { xs: 0.5, sm: 2 }, py: 0.5 }}><Checkbox slotProps={{ input: { "aria-label": `Uniform · ${entry.memberName}` } }} disabled={readOnly} checked={entry.uniform === true} sx={{ minWidth: 44, minHeight: 44, p: 0.5 }} onChange={(event) => update(entry, { uniform: event.target.checked, ...(event.target.checked ? { attendance: "present" } : {}) })} /></TableCell></TableRow>)}</TableBody>
    </Table></TableContainer>
    <LeaderAttendanceSection options={leaders} entries={leaderAttendance} onChange={onLeaderAttendanceChange} disabled={readOnly} loading={leaderAttendanceLoading} />
  </Paper>;
}
