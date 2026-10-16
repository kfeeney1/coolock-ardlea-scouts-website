import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Paper, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import DateRangeFields from "../DateRangeFields";
import { useMemo, useRef, useState } from "react";
import type { WeeklyMeetingRecord } from "../../services/weeklyTracker";
import { filterWeeklyMeetingHistory } from "../../services/weeklyTrackerLogic";
import { SectionIdentityChip, SectionSelect, sectionCardSx } from "../SectionIdentityControls";
import OperationalFilterBar from "./OperationalFilterBar";
import OperationalSearchField from "./OperationalSearchField";
import { formatSiteDate } from "../../services/siteDateFormat";
import { confirmFutureClosedMeetingCleanup, previewFutureClosedMeetings } from "../../services/futureClosedMeetingCleanup";
import type { CleanupPreview } from "../../services/futureClosedMeetingCleanup";

type Props = {
  records: WeeklyMeetingRecord[];
  sections: string[];
  canEditPast: boolean;
  readOnly: boolean;
  canDeleteFutureClosed: boolean;
  onReopen: (record: WeeklyMeetingRecord) => void;
  onRefresh: () => Promise<void>;
};

const displayDate = (value: string) => formatSiteDate(value);

export default function WeeklyMeetingHistoryPanel({ records, sections, canEditPast, readOnly, canDeleteFutureClosed, onReopen, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reopenTarget, setReopenTarget] = useState<WeeklyMeetingRecord | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const cleanupBusyRef = useRef(false);
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null);
  const [cleanupError, setCleanupError] = useState("");
  const [cleanupNotice, setCleanupNotice] = useState("");
  const filteredRecords = useMemo(
    () => filterWeeklyMeetingHistory(records, { search, section, fromDate, toDate }),
    [records, search, section, fromDate, toDate]
  );
  const filtersActive = Boolean(search || section !== "all" || fromDate || toDate);
  const resetFilters = () => { setSearch(""); setSection("all"); setFromDate(""); setToDate(""); };

  const openCleanup = async () => {
    setCleanupOpen(true); setCleanupLoading(true); setCleanupError(""); setCleanupNotice("");
    try { setCleanupPreview(await previewFutureClosedMeetings()); }
    catch { setCleanupError("Unable to refresh the closed meetings. Try again before deleting anything."); }
    finally { setCleanupLoading(false); }
  };
  const confirmCleanup = async () => {
    if (!cleanupPreview || cleanupBusyRef.current || cleanupPreview.meetings.length === 0) return;
    cleanupBusyRef.current = true;
    setCleanupBusy(true); setCleanupError(""); setCleanupNotice("");
    try {
      const result = await confirmFutureClosedMeetingCleanup(cleanupPreview.meetings.map((meeting) => meeting.id));
      if (result.kind === "changed") {
        setCleanupPreview(result.preview);
        setCleanupNotice(`The meeting list changed. Review the updated count of ${result.preview.meetings.length} and confirm again.`);
        return;
      }
      if (result.failed.length) {
        const refreshed = await previewFutureClosedMeetings();
        setCleanupPreview(refreshed);
        setCleanupNotice(`${result.deleted.length} meeting${result.deleted.length === 1 ? " was" : "s were"} deleted. ${result.failed.length} could not be fully deleted. Review the updated count and retry.`);
      } else {
        setCleanupPreview({ today: cleanupPreview.today, meetings: [] });
        setCleanupNotice(`${result.deleted.length} future-dated closed meeting${result.deleted.length === 1 ? " was" : "s were"} deleted with associated records.`);
      }
      await onRefresh();
    } catch {
      setCleanupError("The cleanup could not be completed. Refresh the count and try again; completed deletions will not be repeated.");
      try { setCleanupPreview(await previewFutureClosedMeetings()); } catch { /* retain the last reviewed count */ }
    } finally { cleanupBusyRef.current = false; setCleanupBusy(false); }
  };

  return <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
    <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Meeting History</Typography>
    {canDeleteFutureClosed && <Button variant="outlined" color="error" onClick={() => void openCleanup()} sx={{ mb: 2 }} data-testid="future-closed-meeting-cleanup">Delete future-dated closed meetings</Button>}
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
    <Dialog open={cleanupOpen} onClose={cleanupBusy ? undefined : () => setCleanupOpen(false)} aria-labelledby="future-meeting-cleanup-title" data-testid="future-meeting-cleanup-dialog">
      <DialogTitle id="future-meeting-cleanup-title">Delete future-dated closed meetings?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {cleanupLoading ? "Refreshing the current meeting list…" : cleanupPreview?.meetings.length
            ? `${cleanupPreview.meetings.length} closed meeting${cleanupPreview.meetings.length === 1 ? "" : "s"} dated after today (${displayDate(cleanupPreview.today)}) qualify for deletion. Associated attendance, activity and badgework data may also be removed, where applicable.`
            : cleanupPreview ? `No closed meetings dated after today (${displayDate(cleanupPreview.today)}) qualify for deletion.` : "The current meeting count is not available."}
        </DialogContentText>
        {cleanupNotice && <Alert severity={cleanupPreview?.meetings.length ? "warning" : "success"} sx={{ mt: 2 }} role="status">{cleanupNotice}</Alert>}
        {cleanupError && <Alert severity="error" sx={{ mt: 2 }} role="alert">{cleanupError}</Alert>}
        {cleanupPreview?.meetings.length ? <Box component="ul" sx={{ pl: 2.5, mb: 0, mt: 1 }}>{cleanupPreview.meetings.map((meeting) => <li key={meeting.id}>{displayDate(meeting.meetingDate)} · {meeting.section}</li>)}</Box> : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCleanupOpen(false)} disabled={cleanupBusy}>Cancel</Button>
        <Button variant="contained" color="error" onClick={() => void confirmCleanup()} disabled={cleanupLoading || cleanupBusy || !cleanupPreview?.meetings.length} data-testid="confirm-future-meeting-cleanup">
          {cleanupBusy ? <><CircularProgress size={18} sx={{ mr: 1 }} />Deleting…</> : "Confirm deletion"}
        </Button>
      </DialogActions>
    </Dialog>
  </Paper>;
}
