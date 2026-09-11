export function parseOptionalNumberInput(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function numericInputDisplayValue(value: number | null | undefined): number | "" {
  return value == null ? "" : value;
}
