import { Box, ButtonBase, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { calendarDays, calendarEntriesForDay, type CalendarEntry, type CalendarFilter } from "../../services/groupCalendar";
import { formatSiteDate } from "../../services/siteDateFormat";
const labels = {meeting: "Meeting", event: "Event", maintenance: "Maintenance"};
const accents = {meeting: "success.main", event: "warning.main", maintenance: "info.main"};
export default function CalendarMonthGrid({month, today, entries, type, section, returnTo}: {
  month: string; today: string; entries: CalendarEntry[]; type: CalendarFilter; section: string; returnTo: string;
}) {
  const days = calendarDays(month);
  return <Box role="table" aria-label="Monthly group calendar" sx={{width: "100%", border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper"}}>
    <Box role="row" sx={{display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))"}}>
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <Typography key={day} role="columnheader" sx={{textAlign: "center", py: 1, fontSize: {xs: 11, sm: 14}, fontWeight: 700}}>{day}</Typography>)}
    </Box>
    {Array.from({length: days.length / 7}, (_, row) => <Box key={row} role="row" sx={{display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))"}}>
      {days.slice(row * 7, row * 7 + 7).map(date => <Box key={date} role="cell" aria-label={formatSiteDate(date)} data-calendar-date={date} sx={{minWidth: 0, minHeight: {xs: 85, sm: 120}, p: {xs: 0.25, sm: 0.75}, borderTop: "1px solid", borderRight: "1px solid", borderColor: "divider", bgcolor: date.startsWith(month) ? "background.paper" : "action.hover"}}>
        <Typography component="time" dateTime={date} aria-current={date === today ? "date" : undefined} sx={{display: "block", width: "fit-content", px: 0.5, mb: 0.75, borderRadius: 1, fontWeight: 800, ...(date === today ? {bgcolor: "secondary.main", color: "secondary.contrastText"} : {color: "text.secondary"})}}>{Number(date.slice(-2))}</Typography>
        {calendarEntriesForDay(entries, date, type, section).map(entry => <ButtonBase key={entry.id} component={Link} to={entry.path} state={{calendarReturnTo: returnTo}} aria-label={`${labels[entry.type]}: ${entry.title}, ${formatSiteDate(date)}, ${entry.time || "All day"}${entry.state ? `, ${entry.state}` : ""}`} sx={{display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", minWidth: 0, minHeight: 44, mb: 0.75, p: {xs: 0.25, sm: 0.75}, borderRadius: theme => `${Math.min(Number(theme.shape.borderRadius) || 8, 8)}px`, borderLeft: "3px solid", borderLeftColor: accents[entry.type], bgcolor: "action.hover", color: "text.primary", textAlign: "left", textTransform: "none", overflowWrap: "anywhere", fontFamily: "inherit", fontWeight: 500, fontSize: {xs: 11, sm: 13}, lineHeight: 1.35, "&:focus-visible": {outline: "3px solid", outlineColor: "secondary.main", outlineOffset: -2}}}>
          <Box component="span" sx={{fontWeight: 700}}>{entry.time || "All day"}</Box><span>{entry.title}</span><Box component="span" sx={{fontSize: "0.85em", color: "text.secondary"}}>{labels[entry.type]}<Box component="span" sx={{display: {xs: "none", sm: "inline"}}}> · {entry.section === "Group" ? "Group-wide" : entry.section}</Box>{entry.state && entry.state !== "Open" ? ` · ${entry.state}` : ""}</Box>
        </ButtonBase>)}
      </Box>)}
    </Box>)}
  </Box>;
}
