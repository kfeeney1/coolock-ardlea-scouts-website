import { TextField } from "@mui/material";
import type { TextFieldProps } from "@mui/material";
import { useEffect, useState } from "react";

type Props = Omit<TextFieldProps, "type" | "value" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
};

function clamp(value: number, min: number, max?: number) {
  return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, value));
}

/**
 * Number input that keeps editing text separate from the persisted numeric value.
 * This deliberately permits a temporary empty string so replacing an existing 0
 * does not immediately coerce the field back to 0 (or create values such as 05).
 */
export default function NonNegativeNumberField({
  value,
  onValueChange,
  min = 0,
  max,
  step = 1,
  onBlur,
  onFocus,
  slotProps,
  ...props
}: Props) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [focused, value]);

  const commit = () => {
    if (draft === "") {
      const fallback = clamp(min, min, max);
      setDraft(String(fallback));
      onValueChange(fallback);
      return;
    }
    const parsed = Number(draft);
    const next = Number.isFinite(parsed) ? clamp(parsed, min, max) : min;
    setDraft(String(next));
    onValueChange(next);
  };

  return <TextField
    {...props}
    type="number"
    value={draft}
    onFocus={(event) => {
      setFocused(true);
      onFocus?.(event);
    }}
    onChange={(event) => {
      const next = event.target.value;
      if (next === "") {
        setDraft("");
        return;
      }
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < min || (max !== undefined && parsed > max)) return;
      setDraft(next);
      onValueChange(parsed);
    }}
    onBlur={(event) => {
      setFocused(false);
      commit();
      onBlur?.(event);
    }}
    slotProps={{
      ...slotProps,
      htmlInput: {
        ...(typeof slotProps?.htmlInput === "object" ? slotProps.htmlInput : {}),
        min,
        max,
        step
      }
    }}
  />;
}
