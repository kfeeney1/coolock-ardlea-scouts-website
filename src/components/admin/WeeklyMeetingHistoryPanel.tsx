import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import type { WeeklyMeetingRecord } from "../../services/weeklyTracker";
import { filterWeeklyMeetingHistory } from "../../services/weeklyTrackerLogic";
import OperationalFilterBar from "./OperationalFilterBar";
import OperationalSearchField from "./OperationalSearchField";

type Props = {
  records: WeeklyMeetingRecord[];
  sections: string[];
  canEditPast: boolean;
  readOnly: boolean;
  onOpen: (record: WeeklyMeetingRecord) => void;
  onCopy: (record: WeeklyMeetingRecord) => void;
};

const displayDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IE", { dateStyle: "medium" }).format(date);
};

export default function WeeklyMeetingHistoryPanel({ records, sections, canEditPast, readOnly, onOpen, onCopy }: Props) {
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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
        <Box sx={{ flex: "1 1 260px" }}>
          <OperationalSearchField
            label="Search meeting history"
            value={search}
            onChange={setSearch}
            placeholder="Section, theme, location or programme"
            testId="weekly-history-search"
          />
        </Box>
        <TextField select label="Meeting history section" value={section} onChange={(event) => setSection(event.target.value)} sx={{ minWidth: { md: 190 } }}>
          <MenuItem value="all">All sections</MenuItem>
          {sections.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
        </TextField>
        <TextField label="From date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="To date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        {filtersActive && <Button variant="outlined" onClick={resetFilters} data-testid="weekly-history-reset">Reset filters</Button>}
      </OperationalFilterBar>
      <Typography role="status" data-testid="weekly-history-result-count" color="text.secondary" sx={{ mb: 1.5 }}>
        Showing {filteredRecords.length} of {records.length} closed meetings
      </Typography>
      {!filteredRecords.length ? <Alert severity="info" data-testid="weekly-history-no-results">No closed meetings match these filters.</Alert> : <Stack spacing={1}>
        {filteredRecords.map((record) => {
          const present = record.entries.filter((entry) => entry.attendance === "present").length;
          return <Paper key={record.id} variant="outlined" sx={{ p: 1.5, minWidth: 0 }} data-testid={`meeting-history-${record.id}`}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800 }}>{displayDate(record.meetingDate)} · {record.section}</Typography>
                <Typography color="text.secondary">{present}/{record.entries.length} Present · Closed · {record.activities.length} activities · {record.badgeworkPlan.length} badgework</Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button fullWidth onClick={() => onOpen(record)}>{canEditPast && !readOnly ? "View / Edit" : "View"}</Button>
                {!readOnly && <Button fullWidth onClick={() => onCopy(record)}>Copy Meeting</Button>}
              </Stack>
            </Stack>
          </Paper>;
        })}
      </Stack>}
    </>}
  </Paper>;
}
