import { Alert, Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import type { AttendanceMatrix as Matrix, AttendanceMatrixState } from "../../services/attendanceMatrixLogic";
import { formatSiteDate } from "../../services/siteDateFormat";

const states: Record<AttendanceMatrixState, { label: string; symbol: string; color: "success" | "warning" | "default" }> = {
  present: { label: "Present", symbol: "✓", color: "success" },
  absent: { label: "Absent", symbol: "×", color: "warning" },
  "not-applicable": { label: "Not applicable", symbol: "—", color: "default" },
  unrecorded: { label: "Unrecorded", symbol: "?", color: "default" }
};
const memberCell = { position: "sticky", left: 0, width: { xs: 160, sm: 200 }, minWidth: { xs: 160, sm: 200 }, maxWidth: { xs: 160, sm: 200 }, boxSizing: "border-box", bgcolor: "background.paper", zIndex: 2, overflowWrap: "anywhere", borderRight: 1, borderRightColor: "divider" } as const;

export default function AttendanceMatrix({ matrix }: { matrix: Matrix }) {
  return <Paper variant="outlined" role="region" aria-label="Attendance matrix" sx={{ mb: 3, borderRadius: 3, minWidth: 0, overflow: "hidden", boxShadow: 1 }}>
    <Box sx={{ p: { xs: 2, sm: 3 }, bgcolor: "action.selected" }}>
      <Typography variant="h5" component="h2" color="secondary" sx={{ fontWeight: 800 }}>Attendance matrix</Typography>
      <Typography variant="body2" sx={{ mt: 1 }} id="attendance-matrix-help">Compare closed meetings. Scroll across for more meetings and down for more members. Focus the table area to use arrow keys, Home and End.</Typography>
      <Stack direction="row" useFlexGap spacing={1} sx={{ mt: 2, flexWrap: "wrap" }} aria-label="Attendance legend">
        {Object.entries(states).map(([key, state]) => <Chip key={key} size="small" variant="outlined" color={state.color} label={`${state.symbol} ${state.label}`} />)}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Not applicable: no saved entry and outside the meeting’s section. Unrecorded: no recorded Present or Absent value.</Typography>
    </Box>
    {!matrix.rows.length || !matrix.meetings.length ? <Alert severity="info" sx={{ m: 2 }}>No members or closed meetings match the current filters.</Alert> : <>
      <TableContainer tabIndex={0} role="region" aria-label="Scrollable attendance matrix" aria-describedby="attendance-matrix-help" data-testid="attendance-matrix-scroll" onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        const node = event.currentTarget;
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          if (event.key === "Home" || event.key === "End") node.scrollTo({ left: event.key === "Home" ? 0 : node.scrollWidth });
          else node.scrollBy({ left: event.key === "ArrowLeft" ? -140 : event.key === "ArrowRight" ? 140 : 0, top: event.key === "ArrowUp" ? -64 : event.key === "ArrowDown" ? 64 : 0 });
        }
      }} sx={{ maxHeight: { xs: 420, md: 540 }, width: "100%", overflow: "auto", overscrollBehaviorX: "contain", "&:focus-visible": { outline: "3px solid", outlineColor: "secondary.main", outlineOffset: -3 } }}>
        <Table stickyHeader size="small" aria-label="Member attendance by meeting" sx={{ width: { xs: 160 + matrix.meetings.length * 140, sm: 200 + matrix.meetings.length * 140 }, minWidth: "100%", borderCollapse: "separate", tableLayout: "fixed" }}>
          <TableHead><TableRow>
            <TableCell component="th" scope="col" sx={{ ...memberCell, zIndex: 4, bgcolor: "background.paper", fontWeight: 800 }}>Member</TableCell>
            {matrix.meetings.map(meeting => <TableCell key={meeting.id} component="th" scope="col" sx={{ width: 140, minWidth: 140, maxWidth: 140, boxSizing: "border-box", p: 1.5, bgcolor: "background.paper", verticalAlign: "top", overflowWrap: "anywhere" }}>
              <Typography component="span" variant="body2" color="secondary" sx={{ display: "block", fontWeight: 800 }}>{formatSiteDate(meeting.date)}</Typography>
              <Typography component="span" variant="body2" sx={{ display: "block", whiteSpace: "normal" }}>{meeting.title}</Typography>
              <Typography component="span" variant="caption" color="text.secondary">{meeting.section}</Typography>
            </TableCell>)}
          </TableRow></TableHead>
          <TableBody>{matrix.rows.map(row => <TableRow key={row.memberId}>
            <TableCell component="th" scope="row" sx={{ ...memberCell, p: 1.5, fontWeight: 700 }}>{row.displayName}</TableCell>
            {row.states.map((key, index) => <TableCell key={matrix.meetings[index].id} sx={{ textAlign: "center", py: 1.5, px: 1, bgcolor: index % 2 ? "action.hover" : "background.paper" }}>
              <Chip size="small" variant="outlined" color={states[key].color} label={`${states[key].symbol} ${states[key].label}`} />
            </TableCell>)}
          </TableRow>)}</TableBody>
        </Table>
      </TableContainer>
      <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>{matrix.rows.length} members · {matrix.meetings.length} meetings · Read only</Typography>
    </>}
  </Paper>;
}
