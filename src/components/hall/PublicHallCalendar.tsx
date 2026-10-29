import { Box, Button, IconButton, Paper, Stack, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { calendarDays, calendarMonthCaption, shiftCalendarMonth } from "../../services/groupCalendar";
import { formatSiteDate } from "../../services/siteDateFormat";
import { publicHallDay, publicHallTime, type HallDayTimes } from "../../services/publicHallAvailability.ts";
export default function PublicHallCalendar({month, today, days, selected, choose, changeMonth}: {month: string; today: string; days: Record<string, HallDayTimes>; selected: string; choose: (date: string) => void; changeMonth: (month: string) => void}) {
  const dates = calendarDays(month);
  return <Paper variant="outlined" sx={{p: {xs: 0.5, sm: 2}, borderRadius: 3}}>
    <Stack direction="row" sx={{alignItems: "center"}}><IconButton aria-label="Previous month" disabled={month <= "2000-01"} onClick={() => changeMonth(shiftCalendarMonth(month, -1))} sx={{minWidth: 44, minHeight: 44}}><ChevronLeftIcon /></IconButton><Typography component="h3" variant="h6" aria-live="polite" sx={{flex: 1, textAlign: "center", fontWeight: 800, fontSize: {xs: 16, sm: 20}}}>{calendarMonthCaption(month)}</Typography><IconButton aria-label="Next month" disabled={month >= "2099-12"} onClick={() => changeMonth(shiftCalendarMonth(month, 1))} sx={{minWidth: 44, minHeight: 44}}><ChevronRightIcon /></IconButton></Stack>
    <Button onClick={() => {changeMonth(today.slice(0, 7)); choose(today);}} sx={{minHeight: 44}}>Today</Button>
    <Box role="table" aria-label="Hall availability calendar" sx={{width: "100%", border: "1px solid", borderColor: "divider", borderRadius: 2}}>
      <Box role="row" sx={{display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))"}}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <Typography key={day} role="columnheader" sx={{fontSize: {xs: 10, sm: 14}, textAlign: "center", py: 1, fontWeight: 700}}>{day}</Typography>)}</Box>
      {Array.from({length: dates.length / 7}, (_, row) => <Box key={row} role="row" sx={{display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))"}}>{dates.slice(row * 7, row * 7 + 7).map(date => {
        const current = date.startsWith(month), times = current ? days[date] ?? publicHallDay(date) : null;
        return <Box role="cell" aria-label={formatSiteDate(date)} key={date} sx={{minWidth: 0, p: {xs: 0.2, sm: 0.75}, borderTop: "1px solid", borderRight: "1px solid", borderColor: "divider", bgcolor: !current ? "action.hover" : selected === date ? "action.selected" : "background.paper"}}>
          {current ? <Button aria-label={`Show times for ${formatSiteDate(date)}`} aria-pressed={selected === date} onClick={() => choose(date)} sx={{minWidth: 0, width: "100%", minHeight: 44, p: 0.25, fontWeight: 800, "&:focus-visible": {outline: "3px solid", outlineColor: "secondary.main"}}}><time dateTime={date} aria-current={date === today ? "date" : undefined}>{Number(date.slice(-2))}</time></Button> : <Typography sx={{minHeight: 44, fontSize: 12, pt: 1, textAlign: "center", color: "text.disabled"}}>{Number(date.slice(-2))}</Typography>}
          {times && <Stack spacing={0.5}>{times.occupied.slice(0, 2).map(slot => <Box key={slot.start} sx={{bgcolor: "action.hover", border: "1px solid", borderColor: "divider", borderRadius: 1, p: 0.25}}><Typography sx={{fontSize: {xs: 9, sm: 12}, fontWeight: 700}}>Occupied</Typography><Typography sx={{fontSize: {xs: 10, sm: 12}, overflowWrap: "anywhere"}}>{publicHallTime(slot.start, date)}–{publicHallTime(slot.end, date, true)}</Typography></Box>)}{times.occupied.length > 2 && <Typography sx={{fontSize: {xs: 9, sm: 12}}}>+{times.occupied.length - 2} occupied</Typography>}<Typography sx={{fontSize: {xs: 9, sm: 12}, fontWeight: 700, color: "text.secondary"}}>{times.available.length ? "Unreserved time" : "Full day occupied"}</Typography></Stack>}
        </Box>;
      })}</Box>)}
    </Box>
    <Typography variant="body2" sx={{mt: 1}}>Select a date to see every occupied slot and unreserved time range. Times are Europe/Dublin.</Typography>
  </Paper>;
}
