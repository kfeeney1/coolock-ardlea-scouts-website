import { isCanonicalDateOnly } from "./weeklyMeetingProgrammeLogic.ts";

export const HALL_TIME_ZONE = "Europe/Dublin";
export const DAY_MS = 86_400_000;
export type HallLocalInterval = { date: string; startTime: string; endDate: string; endTime: string };
const formatter = new Intl.DateTimeFormat("en-GB", {timeZone: HALL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"});

export function hallDate(date: string): number {
  if (typeof date !== "string" || !isCanonicalDateOnly(date) || date < "2000-01-01" || date > "2099-12-31") throw new Error("Choose a valid booking date between 2000 and 2099.");
  return Date.parse(`${date}T00:00:00Z`);
}
export function addHallDays(date: string, days: number): string {
  return new Date(hallDate(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Reject clock gaps and repeated local times; never guess an offset for the hirer. */
export function hallInstant(date: string, time: string): number {
  const day = hallDate(date);
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Choose a valid booking time.");
  const [hour, minute] = time.split(":").map(Number);
  const wall = day + (hour * 60 + minute) * 60_000;
  const candidates = [-60, 0, 60].map(offset => wall + offset * 60_000).filter(instant => {
    const parts = formatter.formatToParts(new Date(instant));
    const part = (type: string) => parts.find(value => value.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}` === date && `${part("hour")}:${part("minute")}` === time;
  });
  if (candidates.length !== 1) throw new Error("This Dublin time is missing or repeated at a clock change. Choose an unambiguous time.");
  return candidates[0];
}

export function hallInterval(input: HallLocalInterval): { start: number; end: number } {
  const days = (hallDate(input.endDate) - hallDate(input.date)) / DAY_MS;
  if (days < 0 || days > 7) throw new Error("A booking must end within seven days of its start.");
  const start = hallInstant(input.date, input.startTime), end = hallInstant(input.endDate, input.endTime);
  if (end <= start) throw new Error("Booking end must follow its start.");
  return {start, end};
}
