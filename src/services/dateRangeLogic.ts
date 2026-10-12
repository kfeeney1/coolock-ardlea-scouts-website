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
