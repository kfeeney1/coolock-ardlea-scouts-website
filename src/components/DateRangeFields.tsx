import { useState } from "react";
import { Box, TextField } from "@mui/material";
import { dateRangeError, isIsoCalendarDate } from "../services/dateRangeLogic";

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

/** Controlled date range inputs with the same mobile-safe and keyboard-accessible validation everywhere. */
export default function DateRangeFields({
  startDate, endDate, startLabel, endLabel, onStartDateChange, onEndDateChange,
  startRequired = false, endRequired = false, startName, endName, startTestId, endTestId,
  startError = "", endErrorMessage = "",
}: DateRangeFieldsProps) {
  const [rangeMessage, setRangeMessage] = useState("");
  const endError = rangeMessage || endErrorMessage || dateRangeError(startDate, endDate);

  const updateStart = (value: string) => {
    const nextStart = isIsoCalendarDate(value) ? value : "";
    if (endDate && nextStart && endDate < nextStart) {
      onEndDateChange("");
      setRangeMessage("The end date was cleared because it is before the new start date. Choose a new end date.");
    } else {
      setRangeMessage("");
    }
    onStartDateChange(value);
  };

  const updateEnd = (value: string) => {
    if (!value || !isIsoCalendarDate(value)) {
      setRangeMessage(value ? "Enter a valid end date." : "");
      if (!value) onEndDateChange(value);
      return;
    }
    if (!isIsoCalendarDate(startDate)) {
      setRangeMessage("Enter a valid start date before selecting an end date.");
      return;
    }
    if (value < startDate) {
      setRangeMessage("End date must be on or after the start date.");
      return;
    }
    setRangeMessage("");
    onEndDateChange(value);
  };

  const helperId = `${endName || endLabel.replace(/\s+/g, "-").toLowerCase()}-range-error`;
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2, minWidth: 0 }}>
    <TextField required={startRequired} type="date" label={startLabel} name={startName} value={startDate} onChange={(event) => updateStart(event.target.value)} error={Boolean(startError || (startRequired && !isIsoCalendarDate(startDate)))} helperText={startError} slotProps={{ inputLabel: { shrink: true }, htmlInput: { "data-testid": startTestId } }} />
    <TextField required={endRequired} type="date" label={endLabel} name={endName} value={endDate} onChange={(event) => updateEnd(event.target.value)} disabled={!isIsoCalendarDate(startDate)} error={Boolean(endError)} helperText={endError || (!isIsoCalendarDate(startDate) ? "Enter a valid start date first." : undefined)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: isIsoCalendarDate(startDate) ? startDate : undefined, "data-testid": endTestId, "aria-describedby": helperId }, formHelperText: { id: helperId, role: endError ? "alert" : "status" } }} />
  </Box>;
}
