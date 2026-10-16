import { groupLocalDate } from "./groupLocalDate.ts";

export type DatedParentMeeting = { id: string; meetingDate: string };
export type ParentMeetingViews<T extends DatedParentMeeting> = {
  upcoming: T[];
  previous: T[];
  historical: T[];
};

export function isCanonicalDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Classifies canonical date-only meeting values against the group's local calendar date. */
export function groupParentMeetingsByDate<T extends DatedParentMeeting>(
  meetings: T[],
  today = groupLocalDate()
): ParentMeetingViews<T> {
  const valid = meetings.filter((meeting) => isCanonicalDateOnly(meeting.meetingDate));
  const upcoming = valid
    .filter((meeting) => meeting.meetingDate >= today)
    .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate) || a.id.localeCompare(b.id));
  const previousAll = valid
    .filter((meeting) => meeting.meetingDate < today)
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate) || a.id.localeCompare(b.id));
  return {
    upcoming,
    previous: previousAll.slice(0, 1),
    historical: previousAll.slice(1)
  };
}
