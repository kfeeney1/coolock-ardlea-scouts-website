import { isCanonicalDateOnly } from "./weeklyMeetingProgrammeLogic.ts";
import { decodeProgramme } from "./weeklyMeetingProgrammeText.ts";
import { canonicalMemberSection } from "./memberSectionCore.mjs";
import type { CalendarEntry } from "./groupCalendar.ts";
export type CalendarSourceCollection = "weeklyMeetings" | "events" | "parentWeeklyMeetings" | "parentGalleryEvents" | "publicEvents";
export type CalendarSource = {collection: CalendarSourceCollection; sections: string[]};
const text = (data: Record<string, unknown>, key: string) => typeof data[key] === "string" ? (data[key] as string).trim() : "";
export function calendarSourceEntry(collection: CalendarSourceCollection, id: string, data: Record<string, unknown>): CalendarEntry | null {
  const meeting = collection === "weeklyMeetings" || collection === "parentWeeklyMeetings";
  const date = text(data, meeting ? "meetingDate" : "startDate");
  const endDate = meeting ? date : text(data, "endDate") || date;
  if (!isCanonicalDateOnly(date) || !isCanonicalDateOnly(endDate) || date > endDate || !text(data, "section")) return null;
  const section = canonicalMemberSection(text(data, "section"));
  const theme = text(data, "theme") || (collection === "weeklyMeetings" ? decodeProgramme(text(data, "programmeNotes")).theme : "");
  const title = meeting ? theme || `${section} meeting` : text(data, "title");
  if (!title) return null;
  const state = text(data, "status");
  if (state && !(meeting ? ["open", "closed"] : ["draft", "open", "closed", "completed"]).includes(state)) return null;
  const key = encodeURIComponent(id);
  const path = collection === "weeklyMeetings" ? `/leader/weekly?meeting=${key}` : collection === "events" ? `/leader/events/${key}` : `/calendar/source/${collection}/${key}`;
  // These canonical schemas save date-only values. Activity durations are not a meeting start time.
  return {id: `${meeting ? "meeting" : "event"}:${id}`, type: meeting ? "meeting" : "event", title, date, endDate, time: "", section: ["Group", "All Sections"].includes(section) ? "Group" : section, state: meeting && state === "closed" ? "Completed" : state ? state[0].toUpperCase() + state.slice(1) : "", path};
}
/** Return destinations are local calendar state only, never caller-supplied external URLs. */
export function calendarReturnPath(state: unknown): string | null {
  const value = state && typeof state === "object" && "calendarReturnTo" in state ? state.calendarReturnTo : null;
  if (typeof value !== "string" || !/^\/calendar\?(?:[^#]*)$/.test(value) || value.includes("\\")) return null;
  const params = new URLSearchParams(value.slice(value.indexOf("?") + 1));
  return [...params.keys()].every(key => ["month", "type", "section"].includes(key)) ? value : null;
}
