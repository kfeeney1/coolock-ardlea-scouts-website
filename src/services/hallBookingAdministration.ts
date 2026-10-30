import { addHallDays, DAY_MS, hallDate } from "./hallBookingTime.ts";
import { hallOccurrences, type HallBooking, type HallException } from "./hallBookingDomain.ts";
import { groupLocalDate } from "./groupLocalDate.ts";

export type HallBookingInput = HallBooking & {title: string; hirerName: string; contact: string; notes: string};
export type HallBookingRecord = HallBookingInput & {revision: number; createdBy: string; createdAt: string; updatedBy: string; updatedAt: string; source?: {collection: string; id: string}};
export function newHallBooking(id: string, date = groupLocalDate()): HallBookingInput {
  return {id, resourceId: "group-hall", kind: "internal", state: "draft", title: "", hirerName: "", contact: "", notes: "", interval: {date, startTime: "19:00", endDate: date, endTime: "20:00"}};
}
export function hallBookingInput(record: HallBookingInput): HallBookingInput {
  return {id: record.id, resourceId: "group-hall", kind: record.kind, state: record.state, title: record.title, hirerName: record.hirerName, contact: record.contact, notes: record.notes, interval: {...record.interval}, ...(record.recurrence ? {recurrence: {...record.recurrence}} : {}), ...(record.exceptions ? {exceptions: structuredClone(record.exceptions)} : {})};
}
export function hallSeriesDates(booking: HallBookingInput): string[] {
  const start = hallDate(booking.interval.date), end = booking.recurrence ? hallDate(booking.recurrence.until) : start;
  if (end < start || end - start > 366 * DAY_MS) throw new Error("Choose a series end date within 366 days of its start.");
  return Array.from({length: Math.floor((end - start) / (7 * DAY_MS)) + 1}, (_, index) => addHallDays(booking.interval.date, index * 7));
}
export function hallOccurrenceInterval(booking: HallBookingInput, date: string) {
  if (!hallSeriesDates(booking).includes(date)) throw new Error("Choose an original occurrence date.");
  const exception = booking.exceptions?.find(item => item.date === date);
  return exception?.action === "replace" ? {...exception.interval} : {...booking.interval, date, endDate: addHallDays(date, (hallDate(booking.interval.endDate) - hallDate(booking.interval.date)) / DAY_MS)};
}
export function editHallOccurrence(booking: HallBookingInput, date: string, interval: HallBookingInput["interval"], cancelled: boolean): HallBookingInput {
  if (!hallSeriesDates(booking).includes(date)) throw new Error("Choose an original occurrence date.");
  const exception: HallException = cancelled ? {date, action: "cancel"} : {date, action: "replace", interval: {...interval}};
  const next = {...hallBookingInput(booking), exceptions: [...(booking.exceptions ?? []).filter(item => item.date !== date), exception]};
  hallOccurrences(next); return next;
}
/** Moving the series retains exception identities and relative replacement dates. */
export function rescheduleHallSeries(next: HallBookingInput, original: HallBookingInput): HallBookingInput {
  const delta = (hallDate(next.interval.date) - hallDate(original.interval.date)) / DAY_MS;
  const exceptions = (next.exceptions ?? []).map(item => ({...item, date: addHallDays(item.date, delta), ...(item.action === "replace" ? {interval: {...item.interval, date: addHallDays(item.interval.date, delta), endDate: addHallDays(item.interval.endDate, delta)}} : {})})) as HallException[];
  const value = {...hallBookingInput(next), ...(next.exceptions ? {exceptions} : {})};
  hallOccurrences(value); return value;
}
export function validateHallBookingInput(value: HallBookingInput): string {
  if (!value.title.trim()) return "Enter a booking title.";
  if (value.title.length > 200 || value.hirerName.length > 200 || value.contact.length > 300 || value.notes.length > 3000) return "Shorten the booking details to the permitted lengths.";
  try {hallOccurrences(value); return "";} catch (error) {return error instanceof Error ? error.message : "Check booking dates and times.";}
}

/** Routes only: destination pages retain their own canonical permissions. */
export function maintenanceHallSourcePath(source: HallBookingRecord["source"]): string | null {
  if (source?.collection !== "maintenance/group/appointments" || !/^(?:[a-zA-Z0-9-]{20,64}|task-[a-zA-Z0-9-]{20,64})$/.test(source.id)) return null;
  return source.id.startsWith("task-") ? `/maintenance/tasks/${encodeURIComponent(source.id.slice(5))}` : `/calendar/maintenance/${encodeURIComponent(source.id)}`;
}

export function hallSourcePath(source: HallBookingRecord["source"]): string | null {
  if (source?.collection === "weeklyMeetings" && /^[A-Za-z0-9_-]{1,100}$/.test(source.id)) return `/leader/weekly?meeting=${encodeURIComponent(source.id)}`;
  return maintenanceHallSourcePath(source);
}
