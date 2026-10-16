import { useState } from "react";
import { Box } from "@mui/material";
import DatePickerField from "./DatePickerField";
import { dateRangeError, formatDateRangeInput, isIsoCalendarDate } from "../services/dateRangeLogic";

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

/** Shared date-only ranges. Both fields use the site's confirmable calendar. */
export default function DateRangeFields({
  startDate, endDate, startLabel, endLabel, onStartDateChange, onEndDateChange,
  startRequired = false, endRequired = false, startName, endName, startTestId, endTestId,
  startError = "", endErrorMessage = "",
}: DateRangeFieldsProps) {
  const [rangeMessage, setRangeMessage] = useState("");
  const validation = dateRangeError(startDate, endDate);
  const startIsValid = isIsoCalendarDate(startDate);
  const startValidationMessage = startError || (startRequired && !startIsValid ? "Enter a valid start date." : "");
  const endError = (startIsValid ? rangeMessage : "") || endErrorMessage || validation;
  const initialEndDate = isIsoCalendarDate(endDate) && endDate >= startDate ? endDate : startDate;

  const updateStart = (value: string) => {
    const shouldClearEnd = isIsoCalendarDate(endDate) && isIsoCalendarDate(value) && endDate < value;
    if (shouldClearEnd) {
      setRangeMessage("The end date was cleared because it is before the new start date. Choose a new end date.");
      onEndDateChange("");
    } else setRangeMessage("");
    onStartDateChange(value);
  };

  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2, minWidth: 0 }}>
    <DatePickerField required={startRequired} label={startLabel} name={startName} value={startDate} onChange={(event) => updateStart(event.target.value)} error={Boolean(startValidationMessage)} helperText={startValidationMessage} slotProps={{ inputLabel: { shrink: true }, htmlInput: { "data-testid": startTestId, "aria-invalid": Boolean(startValidationMessage) } }} />
    <DatePickerField required={endRequired} label={endLabel} name={endName} value={endDate} onChange={(event) => { onEndDateChange(event.target.value); setRangeMessage(""); }} disabled={!startIsValid} minDate={startIsValid ? startDate : undefined} minDateErrorMessage="End date cannot be before the start date." initialDate={initialEndDate} calendarDescription={startIsValid ? "Choose a date on or after " + formatDateRangeInput(startDate) + ". The selected date is not applied until you confirm." : "Enter a valid start date first."} calendarDescriptionVisuallyHidden error={Boolean(endError)} helperText={endError || (!startIsValid ? "Enter a valid start date first." : "Use DD-MM-YYYY, or choose a date from the calendar.")} slotProps={{ inputLabel: { shrink: true }, htmlInput: { inputMode: "numeric", autoComplete: "off", "data-testid": endTestId, "data-min-date": startIsValid ? startDate : undefined } }} />
  </Box>;
}
