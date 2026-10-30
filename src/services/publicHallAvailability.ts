import { hallDate, hallInstant } from "./hallBookingTime.ts";
export type PublicHallSlot = {start: string; end: string};
export type HallDayTimes = {occupied: PublicHallSlot[]; available: PublicHallSlot[]};
export function publicHallDay(date: string, value?: Record<string, unknown>): HallDayTimes {
  hallDate(date);
  if (value && (Object.keys(value).some(key => key !== "occupied") || !Array.isArray(value.occupied) || value.occupied.length > 300)) throw new Error("Invalid availability record.");
  const start = hallInstant(date, "00:00"), end = hallInstant(date, "23:59") + 60_000;
  const ranges = ((value?.occupied ?? []) as PublicHallSlot[]).map(slot => {
    if (!slot || Object.keys(slot).some(key => !["start", "end"].includes(key)) || typeof slot.start !== "string" || typeof slot.end !== "string") throw new Error("Invalid occupied slot.");
    const from = Date.parse(slot.start), to = Date.parse(slot.end);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < start || to > end || from >= to || new Date(from).toISOString() !== slot.start || new Date(to).toISOString() !== slot.end) throw new Error("Invalid occupied interval.");
    return {start: from, end: to};
  }).sort((a, b) => a.start - b.start);
  const merged: {start: number; end: number}[] = [];
  for (const range of ranges) {const last = merged.at(-1); if (last && range.start <= last.end) last.end = Math.max(last.end, range.end); else merged.push({...range});}
  const gaps: {start: number; end: number}[] = []; let next = start;
  for (const range of merged) {if (next < range.start) gaps.push({start: next, end: range.start}); next = range.end;}
  if (next < end) gaps.push({start: next, end});
  const encode = ({start, end}: {start: number; end: number}) => ({start: new Date(start).toISOString(), end: new Date(end).toISOString()});
  return {occupied: merged.map(encode), available: gaps.map(encode)};
}
const time = new Intl.DateTimeFormat("en-GB", {timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit", hourCycle: "h23"});
export function publicHallTime(value: string, date: string, end = false): string {
  if (end && Date.parse(value) === hallInstant(date, "23:59") + 60_000) return "24:00";
  return time.format(new Date(value));
}
export function hallEnquiryLink(email: string, date: string, startTime = "", endTime = ""): string {
  if (!/^[^\s@?&#:]+@[^\s@?&#:]+\.[^\s@?&#:]+$/.test(email)) throw new Error("Use the group's published contact email.");
  hallDate(date);
  if (startTime || endTime) {if (hallInstant(date, startTime) >= hallInstant(date, endTime)) throw new Error("End time must follow start time for a same-day enquiry.");}
  const [year, month, day] = date.split("-");
  return `mailto:${email}?subject=${encodeURIComponent(`Hall hire enquiry — ${day}-${month}-${year}`)}&body=${encodeURIComponent(`Hello,\n\nI would like to enquire about hall hire on ${day}-${month}-${year}.${startTime ? `\nRequested times (Europe/Dublin): ${startTime}–${endTime}.` : ""}\n\nPlease confirm availability, facilities, access and hire arrangements. I understand this enquiry does not confirm a booking.\n\nThank you.`)}`;
}
