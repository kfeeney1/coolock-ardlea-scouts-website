import { groupLocalDate } from "./groupLocalDate.ts";
export type ScheduleIdentity = { id: string; date: string; endDate?: string };
export function orderedSchedule<T extends ScheduleIdentity>(records: T[]): T[] {
  return [...records].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
/** ISO date keys are local calendar dates, not UTC timestamps. */
export function scheduleToday(now = new Date()): string {
  return groupLocalDate(now);
}
export function initialScheduleId(records: ScheduleIdentity[], today = scheduleToday()): string {
  const sorted = orderedSchedule(records);
  return sorted.find((r) => r.date <= today && (r.endDate || r.date) >= today)?.id
    ?? sorted.find((r) => r.date > today)?.id ?? sorted.at(-1)?.id ?? "";
}
export function scheduleIdForDate(records: ScheduleIdentity[], date: string): string {
  return initialScheduleId(records, date);
}
