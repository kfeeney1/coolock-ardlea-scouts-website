export type CalendarType = "meeting" | "event" | "maintenance" | "training";
export type CalendarEntry = {
  id: string; type: CalendarType; title: string; date: string; endDate?: string;
  time: string; section: string; state?: string; detail?: string; path: string;
};
export const calendarTypes = ["all", "meeting", "event", "maintenance", "training"] as const;
export type CalendarFilter = typeof calendarTypes[number];
export function calendarMonth(value: string | null, today: string) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= "1900-01" && value <= "2199-12" ? value : today.slice(0, 7);
}
export function shiftCalendarMonth(month: string, amount: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}
export function calendarDays(month: string) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(1 - offset + index);
    return date.toISOString().slice(0, 10);
  });
}
export function calendarMonthCaption(month: string) {
  const parts = new Intl.DateTimeFormat("en-IE", { month: "long", year: "numeric", timeZone: "UTC" }).formatToParts(new Date(`${month}-01T12:00:00Z`));
  return parts.filter(part => part.type === "month" || part.type === "year").map(part => part.value).join(" ");
}
/** Inputs must already have passed canonical source permissions; never infer access here. */
export function calendarEntriesForDay(entries: CalendarEntry[], date: string, type: CalendarFilter, section: string) {
  return entries.filter(entry => entry.date <= date && (entry.endDate || entry.date) >= date
    && (type === "all" || entry.type === type) && (!section || entry.section === section))
    .sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}
