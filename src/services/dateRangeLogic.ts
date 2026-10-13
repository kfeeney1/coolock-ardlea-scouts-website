/** Date-only helpers. ISO date strings compare lexically only after calendar validation. */
export function isIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

/** Accepts the site's displayed DD-MM-YYYY format and ISO date-only values. */
export function parseDateRangeInput(value: string): string | null {
  const input = value.trim();
  if (isIsoCalendarDate(input)) return input;
  const match = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(input);
  if (!match) return null;
  const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
  return isIsoCalendarDate(isoDate) ? isoDate : null;
}

export function formatDateRangeInput(value: string): string {
  if (!isIsoCalendarDate(value)) return value;
  return `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}`;
}

export function dateRangeError(startDate: string, endDate: string): string {
  if (!endDate) return "";
  if (!isIsoCalendarDate(startDate)) return "Enter a valid start date before selecting an end date.";
  if (!isIsoCalendarDate(endDate)) return "Enter a valid end date.";
  if (endDate < startDate) return "End date must be on or after the start date.";
  return "";
}

export function isValidDateRange(startDate: string, endDate: string, options: { requireStart?: boolean; requireEnd?: boolean } = {}): boolean {
  const { requireStart = true, requireEnd = false } = options;
  if (requireStart && !isIsoCalendarDate(startDate)) return false;
  if (requireEnd && !isIsoCalendarDate(endDate)) return false;
  if (startDate && !isIsoCalendarDate(startDate)) return false;
  if (endDate && !isIsoCalendarDate(endDate)) return false;
  return !startDate || !endDate || endDate >= startDate;
}
