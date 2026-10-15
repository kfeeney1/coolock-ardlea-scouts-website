import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Paper, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import DateRangeFields from "../DateRangeFields";
import { useMemo, useState } from "react";
import type { WeeklyMeetingRecord } from "../../services/weeklyTracker";
import { filterWeeklyMeetingHistory } from "../../services/weeklyTrackerLogic";
import { SectionIdentityChip, SectionSelect, sectionCardSx } from "../SectionIdentityControls";
import OperationalFilterBar from "./OperationalFilterBar";
import OperationalSearchField from "./OperationalSearchField";
import { formatSiteDate } from "../../services/siteDateFormat";

type Props = {
  records: WeeklyMeetingRecord[];
  sections: string[];
  canEditPast: boolean;
  readOnly: boolean;
  onReopen: (record: WeeklyMeetingRecord) => void;
};

const displayDate = (value: string) => formatSiteDate(value);

export default function WeeklyMeetingHistoryPanel({ records, sections, canEditPast, readOnly, onReopen }: Props) {
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reopenTarget, setReopenTarget] = useState<WeeklyMeetingRecord | null>(null);
  const filteredRecords = useMemo(
    () => filterWeeklyMeetingHistory(records, { search, section, fromDate, toDate }),
    [records, search, section, fromDate, toDate]
  );
  const filtersActive = Boolean(search || section !== "all" || fromDate || toDate);
  const resetFilters = () => { setSearch(""); setSection("all"); setFromDate(""); setToDate(""); };

  return <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
    <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Meeting History</Typography>
    {!records.length ? <Alert severity="info">No closed meetings yet.</Alert> : <>
      <OperationalFilterBar>
        <Box sx={{ flex: { xs: "0 0 auto", md: "1 1 260px" } }}>
          <OperationalSearchField
            label="Search meeting history"
            value={search}
            onChange={setSearch}
            placeholder="Section, theme, location or programme"
            testId="weekly-history-search"
          />
        </Box>
        <Box sx={{ minWidth: { md: 190 } }}>
          <SectionSelect
            id="weekly-history-section"
            label="Meeting history section"
            value={section}
            options={sections}
            allValue="all"
            allLabel="All sections"
            onChange={(event) => setSection(event.target.value)}
            fullWidth
          />
        </Box>
        <DateRangeFields startDate={fromDate} endDate={toDate} startLabel="From date" endLabel="To date" onStartDateChange={setFromDate} onEndDateChange={setToDate} />
        {filtersActive && <Button variant="outlined" onClick={resetFilters} data-testid="weekly-history-reset">Reset filters</Button>}
      </OperationalFilterBar>
      <Typography role="status" data-testid="weekly-history-result-count" color="text.secondary" sx={{ mb: 1.5 }}>
        Showing {filteredRecords.length} of {records.length} closed meetings
      </Typography>
      {!filteredRecords.length ? <Alert severity="info" data-testid="weekly-history-no-results">No closed meetings match these filters.</Alert> : <Stack spacing={1}>
        {filteredRecords.map((record) => {
          const present = record.entries.filter((entry) => entry.attendance === "present").length;
          return <Paper key={record.id} variant="outlined" sx={[{ p: 1.5, minWidth: 0 }, sectionCardSx(record.section)]} data-testid={`meeting-history-${record.id}`} data-section={record.section}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography data-testid="weekly-history-date" sx={{ fontWeight: 800 }}>{displayDate(record.meetingDate)} · {record.section}</Typography>
                <Box sx={{ mt: .5, mb: .5 }}><SectionIdentityChip section={record.section} /></Box>
                <Typography color="text.secondary">{present}/{record.entries.length} Present · Closed · {record.activities.length} activities · {record.badgeworkPlan.length} badgework</Typography>
              </Box>
              <Box data-testid="weekly-history-actions" sx={{
                display: "grid", gridTemplateColumns: `repeat(${readOnly ? 1 : 3}, minmax(0, 1fr))`, gap: 1,
                width: { xs: "100%", sm: 360 }, flexShrink: 0, maxWidth: "100%",
                "& .MuiButton-root": { minWidth: 0, minHeight: 44, px: 1, whiteSpace: "normal", lineHeight: 1.4,
                  "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }
              }}>
                <Button fullWidth variant="outlined" component={Link} to={`/leader/weekly?meeting=${encodeURIComponent(record.id)}`}>{canEditPast && !readOnly ? "View / Edit" : "View"}</Button>
                {!readOnly && <Button fullWidth variant="outlined" onClick={() => setReopenTarget(record)}>Reopen Meeting</Button>}{!readOnly && <Button fullWidth variant="outlined" component={Link} to={`/leader/weekly/copy/${encodeURIComponent(record.id)}`}>Copy Meeting</Button>}
              </Box>
            </Stack>
          </Paper>;
        })}
      </Stack>}
    </>}
    <Dialog open={Boolean(reopenTarget)} onClose={() => setReopenTarget(null)} aria-labelledby="weekly-reopen-title">
      <DialogTitle id="weekly-reopen-title">Reopen meeting?</DialogTitle>
      <DialogContent>
        <DialogContentText>{reopenTarget ? `${displayDate(reopenTarget.meetingDate)} · ${reopenTarget.section} will return to Open Meeting. Its saved attendance, programme, badgework, incidents and notes will be retained.` : ""}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setReopenTarget(null)}>Cancel</Button>
        <Button variant="contained" onClick={() => { const record = reopenTarget; setReopenTarget(null); if (record) onReopen(record); }}>Reopen Meeting</Button>
      </DialogActions>
    </Dialog>
  </Paper>;
}
