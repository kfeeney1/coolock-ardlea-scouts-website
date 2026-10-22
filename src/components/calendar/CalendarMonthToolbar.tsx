import { Box, Button, ButtonBase, IconButton, Stack, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { calendarMonthCaption, calendarTypes, shiftCalendarMonth, type CalendarFilter } from "../../services/groupCalendar";
const labels = {all: "All", meeting: "Meetings", event: "Events", maintenance: "Maintenance"};
export default function CalendarMonthToolbar({month, today, type, update}: {
  month: string; today: string; type: CalendarFilter; update: (key: string, value: string) => void;
}) {
  return <Stack spacing={1.5}>
    <Stack direction="row" spacing={0.5} sx={{alignItems: "center"}}>
      <IconButton aria-label="Previous month" disabled={month === "1900-01"} onClick={() => update("month", shiftCalendarMonth(month, -1))} sx={{minWidth: 44, minHeight: 44, color: "text.primary"}}><ChevronLeftIcon /></IconButton>
      <Typography component="h2" variant="h6" aria-live="polite" sx={{flex: 1, fontWeight: 800, fontSize: {xs: "1.05rem", sm: "1.25rem"}}}>{calendarMonthCaption(month)}</Typography>
      <IconButton aria-label="Next month" disabled={month === "2199-12"} onClick={() => update("month", shiftCalendarMonth(month, 1))} sx={{minWidth: 44, minHeight: 44, color: "text.primary"}}><ChevronRightIcon /></IconButton>
      <Button color="secondary" onClick={() => update("month", today.slice(0, 7))} sx={{minHeight: 44, minWidth: 0, px: 1.5, borderRadius: 2, boxShadow: "none"}}>Today</Button>
    </Stack>
    <Box component="nav" aria-label="Calendar type filters" sx={{display: "grid", gridTemplateColumns: "minmax(44px, 0.65fr) minmax(44px, 1fr) minmax(44px, 0.8fr) minmax(80px, 1.4fr)", gap: 0.5, p: 0.5, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper"}}>
      {calendarTypes.map(option => <ButtonBase key={option} aria-pressed={type === option} onClick={() => update("type", option)} sx={{minHeight: 44, minWidth: 0, px: 0.25, borderRadius: 1.5, fontFamily: "inherit", fontWeight: 800, fontSize: {xs: "0.75rem", sm: "0.875rem"}, lineHeight: 1.3, whiteSpace: "nowrap", color: type === option ? "secondary.contrastText" : "text.primary", bgcolor: type === option ? "secondary.main" : "transparent", "&:hover": {bgcolor: type === option ? "secondary.dark" : "action.hover"}, "&:focus-visible": {outline: "3px solid", outlineColor: "secondary.main", outlineOffset: 1}}}>{labels[option]}</ButtonBase>)}
    </Box>
  </Stack>;
}
