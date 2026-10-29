import { addHallDays, DAY_MS, hallDate, hallInterval, type HallLocalInterval } from "./hallBookingTime.ts";

export type HallBookingState = "draft" | "confirmed" | "cancelled";
export type HallBookingKind = "internal" | "external" | "blocked";
export type HallException = { date: string; action: "cancel" } | { date: string; action: "replace"; interval: HallLocalInterval };
export type HallBooking = {
  id: string; resourceId: "group-hall"; kind: HallBookingKind; state: HallBookingState;
  interval: HallLocalInterval;
  recurrence?: { frequency: "weekly"; until: string };
  exceptions?: HallException[];
};
export type HallOccurrence = { bookingId: string; occurrenceDate: string; start: number; end: number };
export type PublicHallOccupied = { start: string; end: string };

/** Pure domain validation only: callers must authorise and reserve atomically before persisting. */
export function hallOccurrences(booking: HallBooking): HallOccurrence[] {
  if (!booking || !/^[A-Za-z0-9-]{1,100}$/.test(booking.id) || booking.resourceId !== "group-hall" || !["internal", "external", "blocked"].includes(booking.kind) || !["draft", "confirmed", "cancelled"].includes(booking.state)) throw new Error("Invalid hall booking.");
  const initial = hallInterval(booking.interval);
  const dates = [booking.interval.date];
  if (booking.recurrence) {
    const {frequency, until} = booking.recurrence;
    const span = (hallDate(until) - hallDate(booking.interval.date)) / DAY_MS;
    if (frequency !== "weekly" || span < 0 || span > 366) throw new Error("Weekly bookings require an end date within 366 days.");
    for (let days = 7; days <= span; days += 7) dates.push(addHallDays(booking.interval.date, days));
  }
  if (booking.exceptions !== undefined && (!Array.isArray(booking.exceptions) || booking.exceptions.length > dates.length)) throw new Error("Invalid occurrence exceptions.");
  const exceptions = new Map<string, HallException>();
  for (const exception of booking.exceptions ?? []) {
    if (!exception || !dates.includes(exception.date) || exceptions.has(exception.date) || !["cancel", "replace"].includes(exception.action)) throw new Error("Exceptions must identify a unique occurrence in this booking.");
    exceptions.set(exception.date, exception);
  }
  const durationDays = (hallDate(booking.interval.endDate) - hallDate(booking.interval.date)) / DAY_MS;
  const occurrences: HallOccurrence[] = [];
  for (const date of dates) {
    const exception = exceptions.get(date);
    if (exception?.action === "cancel") continue;
    const interval = exception?.action === "replace" ? exception.interval : {...booking.interval, date, endDate: addHallDays(date, durationDays)};
    // Moving one occurrence cannot extend the bounded series indefinitely.
    if (Math.abs(hallDate(interval.date) - hallDate(date)) > 366 * DAY_MS) throw new Error("Move an occurrence by no more than 366 days.");
    const value = date === booking.interval.date && !exception ? initial : hallInterval(interval);
    occurrences.push({bookingId: booking.id, occurrenceDate: date, ...value});
  }
  // A moved occurrence may collide with another occurrence of the same series.
  const sorted = occurrences.sort((a, b) => a.start - b.start);
  if (sorted.some((value, index) => index > 0 && sorted[index - 1].end > value.start)) throw new Error("Occurrences in this booking overlap.");
  return booking.state === "confirmed" ? sorted : [];
}

/** Half-open [start,end) intervals: an end equal to another start is available. */
export function hallOverlaps(a: Pick<HallOccurrence, "start" | "end">, b: Pick<HallOccurrence, "start" | "end">): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Deliberate allowlist. Never spread booking/source objects into public output. */
export function publicHallOccupied(bookings: HallBooking[]): PublicHallOccupied[] {
  return bookings.flatMap(hallOccurrences).sort((a, b) => a.start - b.start).map(({start, end}) => ({start: new Date(start).toISOString(), end: new Date(end).toISOString()}));
}
