import { useEffect, useId, useRef, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { dateRangeError, formatDateRangeInput, isIsoCalendarDate, parseDateRangeInput } from "../services/dateRangeLogic";

type DateRangeFieldsProps = {
  startDate: string;
  endDate: string;
  startLabel: string;
  endLabel: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  startRequired?: boolean;
  endRequired?: boolean;
  startError?: string;
  endErrorMessage?: string;
  startName?: string;
  endName?: string;
  startTestId?: string;
  endTestId?: string;
};

type CalendarMonth = { year: number; month: number };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthFor(value: string): CalendarMonth {
  if (isIsoCalendarDate(value)) return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) };
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

function shiftMonth(value: CalendarMonth, amount: number): CalendarMonth {
  const index = value.year * 12 + value.month - 1 + amount;
  return { year: Math.floor(index / 12), month: index % 12 + 1 };
}

function utcCalendarDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function monthLabel(value: CalendarMonth): string {
  return new Intl.DateTimeFormat("en-IE", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(utcCalendarDate(value.year, value.month, 1));
}

function monthDays(value: CalendarMonth): string[] {
  const firstDay = utcCalendarDate(value.year, value.month, 1).getUTCDay();
  const mondayOffset = (firstDay + 6) % 7;
  const count = utcCalendarDate(value.year, value.month + 1, 0).getUTCDate();
  return [...Array(mondayOffset).fill(""), ...Array.from({ length: count }, (_, index) =>
    `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`)];
}

function compareMonth(left: CalendarMonth, right: CalendarMonth): number {
  return left.year - right.year || left.month - right.month;
}

/** Shared date-only ranges. The end calendar keeps its draft selection separate until confirmation. */
export default function DateRangeFields({
  startDate, endDate, startLabel, endLabel, onStartDateChange, onEndDateChange,
  startRequired = false, endRequired = false, startName, endName, startTestId, endTestId,
  startError = "", endErrorMessage = "",
}: DateRangeFieldsProps) {
  const [rangeMessage, setRangeMessage] = useState("");
  const inputId = useId();
  const [endText, setEndText] = useState(() => formatDateRangeInput(endDate));
  const lastSyncedEnd = useRef(endDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<CalendarMonth>(() => monthFor(startDate));
  const [calendarSelection, setCalendarSelection] = useState("");

  useEffect(() => {
    if (endDate !== lastSyncedEnd.current) {
      lastSyncedEnd.current = endDate;
      setEndText(formatDateRangeInput(endDate));
      setRangeMessage("");
    }
  }, [endDate]);

  const validation = dateRangeError(startDate, endDate);
  const endError = rangeMessage || endErrorMessage || validation;
  const startIsValid = isIsoCalendarDate(startDate);
  const helperId = `${endName || endLabel.replace(/\s+/g, "-").toLowerCase()}-range-error-${inputId}`;

  const updateStart = (value: string) => {
    const shouldClearEnd = Boolean(endDate && (!isIsoCalendarDate(endDate) || (isIsoCalendarDate(value) && endDate < value)));
    if (shouldClearEnd) {
      lastSyncedEnd.current = "";
      setEndText("");
      setRangeMessage("The end date was cleared because it is before the new start date. Choose a new end date.");
    } else {
      setRangeMessage("");
    }
    onStartDateChange(value);
    if (shouldClearEnd) onEndDateChange("");
  };

  const updateEndText = (value: string) => {
    setEndText(value);
    if (!value.trim()) {
      lastSyncedEnd.current = "";
      onEndDateChange("");
      setRangeMessage("");
      return;
    }
    const parsed = parseDateRangeInput(value);
    if (!parsed) {
      lastSyncedEnd.current = value;
      onEndDateChange(value);
      setRangeMessage("Enter a real date as DD-MM-YYYY.");
      return;
    }
    if (!startIsValid) {
      lastSyncedEnd.current = value;
      onEndDateChange(value);
      setRangeMessage("Enter a valid start date before selecting an end date.");
      return;
    }
    if (parsed < startDate) {
      lastSyncedEnd.current = value;
      onEndDateChange(value);
      setRangeMessage("End date must be on or after the start date.");
      return;
    }
    lastSyncedEnd.current = parsed;
    onEndDateChange(parsed);
    setRangeMessage("");
  };

  const openCalendar = () => {
    if (!startIsValid) return;
    const initialSelection = isIsoCalendarDate(endDate) && endDate >= startDate ? endDate : startDate;
    setCalendarSelection(initialSelection);
    setVisibleMonth(monthFor(initialSelection));
    setCalendarOpen(true);
  };

  const confirmCalendarSelection = () => {
    if (!isIsoCalendarDate(calendarSelection) || calendarSelection < startDate) return;
    lastSyncedEnd.current = calendarSelection;
    setEndText(formatDateRangeInput(calendarSelection));
    onEndDateChange(calendarSelection);
    setRangeMessage("");
    setCalendarOpen(false);
  };

  const startMonth = monthFor(startDate);
  const days = monthDays(visibleMonth);
  const previousMonth = shiftMonth(visibleMonth, -1);
  const nextMonth = shiftMonth(visibleMonth, 1);

  return <>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2, minWidth: 0 }}>
      <TextField required={startRequired} type="date" label={startLabel} name={startName} value={startDate} onChange={(event) => updateStart(event.target.value)} error={Boolean(startError || (startRequired && !startIsValid))} helperText={startError} slotProps={{ inputLabel: { shrink: true }, htmlInput: { "data-testid": startTestId } }} />
      <TextField required={endRequired} type="text" label={endLabel} name={endName} value={endText} onChange={(event) => updateEndText(event.target.value)} onBlur={() => { const parsed = parseDateRangeInput(endText); if (parsed && parsed >= startDate) setEndText(formatDateRangeInput(parsed)); }} disabled={!startIsValid} placeholder="DD-MM-YYYY" error={Boolean(endError)} helperText={endError || (!startIsValid ? "Enter a valid start date first." : "Use DD-MM-YYYY, or choose a date from the calendar.")} slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: "numeric", autoComplete: "off", "data-testid": endTestId, "aria-describedby": helperId, "aria-invalid": Boolean(endError), "data-min-date": startIsValid ? startDate : undefined }, formHelperText: { id: helperId, role: endError ? "alert" : "status" }, input: { endAdornment: <InputAdornment position="end"><IconButton aria-label={`Choose ${endLabel.toLowerCase()}`} onClick={openCalendar} disabled={!startIsValid} edge="end"><CalendarTodayIcon /></IconButton></InputAdornment> } }} />
    </Box>
    <Dialog open={calendarOpen} onClose={() => setCalendarOpen(false)} aria-labelledby="date-range-calendar-title" aria-describedby="date-range-calendar-help" fullWidth maxWidth="xs">
      <DialogTitle id="date-range-calendar-title">Choose {endLabel.toLowerCase()}</DialogTitle>
      <DialogContent>
        <Typography id="date-range-calendar-help" color="text.secondary" sx={{ mb: 1 }}>Choose a date on or after {formatDateRangeInput(startDate)}. The selected date is not applied until you confirm.</Typography>
        <Stack direction="row" sx={{ mb: 1, alignItems: "center", justifyContent: "space-between" }}>
          <IconButton aria-label="Previous month" disabled={compareMonth(visibleMonth, startMonth) <= 0} onClick={() => setVisibleMonth(previousMonth)}>‹</IconButton>
          <Typography aria-live="polite" sx={{ fontWeight: 700 }}>{monthLabel(visibleMonth)}</Typography>
          <IconButton aria-label="Next month" onClick={() => setVisibleMonth(nextMonth)}>›</IconButton>
        </Stack>
        <Typography aria-live="polite" sx={{ mb: 1 }}>Selected date: {formatDateRangeInput(calendarSelection)}</Typography>
        <Box role="group" aria-label={`${monthLabel(visibleMonth)} dates`} sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0.5 }}>
          {WEEKDAYS.map((day) => <Typography key={day} aria-label={day} sx={{ textAlign: "center", fontSize: "0.8rem", fontWeight: 700, py: 0.5 }}>{day}</Typography>)}
          {days.map((date, index) => date ? <Button key={date} aria-label={`Select ${formatDateRangeInput(date)}`} aria-pressed={calendarSelection === date} disabled={date < startDate} variant={calendarSelection === date ? "contained" : "text"} onClick={() => setCalendarSelection(date)} sx={{ minWidth: 0, minHeight: 40, p: 0 }}>{Number(date.slice(8, 10))}</Button> : <Box key={`blank-${index}`} aria-hidden="true" />)}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCalendarOpen(false)}>Cancel</Button>
        <Button variant="contained" onClick={confirmCalendarSelection} disabled={!calendarSelection || calendarSelection < startDate}>Confirm date</Button>
      </DialogActions>
    </Dialog>
  </>;
}
