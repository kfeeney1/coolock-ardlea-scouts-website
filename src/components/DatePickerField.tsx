import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Stack, TextField, Typography, type TextFieldProps } from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { formatDateRangeInput, isIsoCalendarDate, parseDateRangeInput } from "../services/dateRangeLogic";

type CalendarMonth = { year: number; month: number };
type Props = Omit<TextFieldProps, "value" | "onChange" | "type"> & { value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; minDate?: string; maxDate?: string; minDateErrorMessage?: string; initialDate?: string; calendarDescription?: string };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (value: number) => String(value).padStart(2, "0");
const todayIso = () => { const now = new Date(); return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()); };
const monthOf = (value: string): CalendarMonth => isIsoCalendarDate(value) ? { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) } : { year: Number(todayIso().slice(0, 4)), month: Number(todayIso().slice(5, 7)) };
const shiftMonth = (value: CalendarMonth, delta: number): CalendarMonth => { const index = value.year * 12 + value.month - 1 + delta; return { year: Math.floor(index / 12), month: index % 12 + 1 }; };
const utcDate = (year: number, month: number, day: number) => { const date = new Date(0); date.setUTCHours(0, 0, 0, 0); date.setUTCFullYear(year, month - 1, day); return date; };
const monthName = (value: CalendarMonth) => MONTHS[value.month - 1] + " " + value.year;
const dateFor = (year: number, month: number, day: number) => String(year).padStart(4, "0") + "-" + pad(month) + "-" + pad(day);
const daysFor = (value: CalendarMonth) => {
  const offset = (utcDate(value.year, value.month, 1).getUTCDay() + 6) % 7;
  const count = utcDate(value.year, value.month + 1, 0).getUTCDate();
  return [...Array(offset).fill(""), ...Array.from({ length: count }, (_, index) => dateFor(value.year, value.month, index + 1))];
};
const compareMonth = (a: CalendarMonth, b: CalendarMonth) => a.year - b.year || a.month - b.month;
function changeEvent(value: string, name: string): ChangeEvent<HTMLInputElement> { return { target: { value, name }, currentTarget: { value, name } } as ChangeEvent<HTMLInputElement>; }

/** Date-only input and calendar used throughout the site. Parent values remain ISO date-only strings. */
export default function DatePickerField({ value, onChange, minDate, maxDate, minDateErrorMessage, initialDate, calendarDescription, label, disabled, required, error, helperText, slotProps, ...props }: Props) {
  const id = useId();
  const inputElement = useRef<HTMLInputElement>(null);
  const dayButtons = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [text, setText] = useState(() => formatDateRangeInput(value));
  const [inputError, setInputError] = useState("");
  const [open, setOpen] = useState(false);
  const today = todayIso();
  const initial = isIsoCalendarDate(value) ? value : isIsoCalendarDate(initialDate || "") ? initialDate! : isIsoCalendarDate(minDate || "") ? minDate! : today;
  const [visibleMonth, setVisibleMonth] = useState(() => monthOf(initial));
  const [selection, setSelection] = useState(initial);
  const title = String(label || "date");
  const name = typeof props.name === "string" ? props.name : "";
  const allowed = (date: string) => isIsoCalendarDate(date) && (!minDate || date >= minDate) && (!maxDate || date <= maxDate);

  useEffect(() => { setText(formatDateRangeInput(value)); setInputError(""); inputElement.current?.setCustomValidity(""); }, [value]);
  const updateText = (raw: string) => {
    setText(raw);
    if (!raw.trim()) { setInputError(required ? "Enter a valid date as DD-MM-YYYY." : ""); onChange(changeEvent("", name)); return; }
    const parsed = parseDateRangeInput(raw);
    if (!parsed) { setInputError("Enter a real date as DD-MM-YYYY."); return; }
    if (!allowed(parsed)) { setInputError(minDate && parsed < minDate ? minDateErrorMessage || "Choose a date on or after " + formatDateRangeInput(minDate) + "." : "Choose a date within the available range."); return; }
    setText(formatDateRangeInput(parsed)); setInputError(""); inputElement.current?.setCustomValidity(""); onChange(changeEvent(parsed, name));
  };
  const openCalendar = () => {
    if (disabled) return;
    const initialValue = allowed(value) ? value : allowed(initialDate || "") ? initialDate! : allowed(minDate || "") ? minDate! : today;
    setSelection(initialValue); setVisibleMonth(monthOf(initialValue)); setOpen(true);
  };
  const confirm = () => { if (!allowed(selection)) return; setText(formatDateRangeInput(selection)); setInputError(""); inputElement.current?.setCustomValidity(""); onChange(changeEvent(selection, name)); setOpen(false); };
  const monthDays = daysFor(visibleMonth);
  const previousMonth = shiftMonth(visibleMonth, -1);
  const nextMonth = shiftMonth(visibleMonth, 1);
  const minMonth = isIsoCalendarDate(minDate || "") ? monthOf(minDate!) : null;
  const htmlInputProps = (slotProps?.htmlInput || {}) as Record<string, unknown>;
  const inputSlotProps = (slotProps?.input || {}) as Record<string, unknown>;
  const helperSlotProps = (slotProps?.formHelperText || {}) as Record<string, unknown>;
  const focusDate = (date: string) => dayButtons.current.get(date)?.focus();
  const moveFocus = (date: string) => {
    const targetMonth = monthOf(date);
    if (compareMonth(targetMonth, visibleMonth) !== 0) { setVisibleMonth(targetMonth); requestAnimationFrame(() => focusDate(date)); }
    else focusDate(date);
  };
  const dayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const cursor = utcDate(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)));
    const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -7 : event.key === "ArrowDown" ? 7 : 0;
    if (delta) { event.preventDefault(); cursor.setUTCDate(cursor.getUTCDate() + delta); moveFocus(cursor.toISOString().slice(0, 10)); }
    else if (event.key === "Home" || event.key === "End") { event.preventDefault(); const offset = (cursor.getUTCDay() + 6) % 7; cursor.setUTCDate(cursor.getUTCDate() + (event.key === "Home" ? -offset : 6 - offset)); moveFocus(cursor.toISOString().slice(0, 10)); }
    else if (event.key === "PageUp" || event.key === "PageDown") { event.preventDefault(); let month = shiftMonth(monthOf(date), event.key === "PageUp" ? -1 : 1); if (minMonth && compareMonth(month, minMonth) < 0) month = minMonth; setVisibleMonth(month); const day = Math.min(Number(date.slice(8, 10)), utcDate(month.year, month.month + 1, 0).getUTCDate()); requestAnimationFrame(() => focusDate(dateFor(month.year, month.month, day))); }
  };

  return <>
    <TextField {...props} type="text" label={label} value={text} disabled={disabled} required={required} error={Boolean(error || inputError)} helperText={inputError || helperText} inputRef={inputElement} onChange={(event) => { const raw = event.target.value; updateText(raw); const parsed = parseDateRangeInput(raw); event.currentTarget.setCustomValidity(raw.trim() && (!parsed || !allowed(parsed)) ? (minDate && parsed && parsed < minDate ? minDateErrorMessage || "Choose a date on or after " + formatDateRangeInput(minDate) + "." : "Enter a valid date as DD-MM-YYYY.") : ""); }} onBlur={() => { const parsed = parseDateRangeInput(text); if (parsed && allowed(parsed)) setText(formatDateRangeInput(parsed)); }} slotProps={{ ...slotProps, inputLabel: { shrink: true, ...slotProps?.inputLabel }, htmlInput: { inputMode: "numeric", autoComplete: "off", placeholder: "DD-MM-YYYY", ...htmlInputProps, "aria-invalid": Boolean(error || inputError) }, formHelperText: { ...helperSlotProps, role: error || inputError ? "alert" : "status" }, input: { ...inputSlotProps, endAdornment: <InputAdornment position="end"><IconButton aria-label={"Choose " + title.toLowerCase()} disabled={disabled} onClick={openCalendar} edge="end"><CalendarTodayIcon /></IconButton>{inputSlotProps.endAdornment as React.ReactNode}</InputAdornment> } }} />
    <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby={id + "-title"} aria-describedby={id + "-description"} fullWidth maxWidth="xs" scroll="paper">
      <DialogTitle id={id + "-title"}>Choose {title.toLowerCase()}</DialogTitle>
      <DialogContent>
        <Typography id={id + "-description"} color="text.secondary" sx={{ mb: 1 }}>{calendarDescription || "Enter or select a date. The selected date is not applied until you confirm."}</Typography>
        <Stack direction="row" sx={{ mb: 1, alignItems: "center", justifyContent: "space-between" }}>
          <IconButton aria-label="Previous month" disabled={Boolean(minMonth && compareMonth(visibleMonth, minMonth) <= 0)} onClick={() => setVisibleMonth(previousMonth)}>‹</IconButton>
          <Typography aria-live="polite" sx={{ fontWeight: 700 }}>{monthName(visibleMonth)}</Typography>
          <IconButton aria-label="Next month" onClick={() => setVisibleMonth(nextMonth)}>›</IconButton>
        </Stack>
        <Typography aria-live="polite" sx={{ mb: 1 }}>Selected date: {formatDateRangeInput(selection)}</Typography>
        <Box role="group" aria-label={monthName(visibleMonth) + " dates"} sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0.5 }}>
          {WEEKDAYS.map((day) => <Typography key={day} aria-label={day} sx={{ textAlign: "center", fontSize: "0.8rem", fontWeight: 700, py: 0.5 }}>{day}</Typography>)}
          {monthDays.map((date, index) => date ? <Button key={date} ref={(node: HTMLButtonElement | null) => { if (node) dayButtons.current.set(date, node); else dayButtons.current.delete(date); }} aria-label={"Select " + formatDateRangeInput(date)} aria-pressed={selection === date} aria-current={today === date ? "date" : undefined} disabled={!allowed(date)} variant={selection === date ? "contained" : "text"} onClick={() => setSelection(date)} onKeyDown={(event) => dayKeyDown(event, date)} sx={{ minWidth: 0, minHeight: { xs: 44, sm: 40 }, p: 0, outline: today === date ? "2px solid" : undefined, outlineColor: "primary.main" }}>{Number(date.slice(8, 10))}</Button> : <Box key={"blank-" + index} aria-hidden="true" />)}
        </Box>
      </DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={confirm} disabled={!allowed(selection)}>Confirm date</Button></DialogActions>
    </Dialog>
  </>;
}
