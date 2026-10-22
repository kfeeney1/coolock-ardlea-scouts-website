import { isCanonicalDateOnly } from "./weeklyMeetingProgrammeLogic.ts";
import type { CalendarEntry } from "./groupCalendar.ts";
export type AppointmentInput = {title: string; date: string; allDay: boolean; startTime: string; endTime: string; location: string; notes: string};
export type MaintenanceAppointment = AppointmentInput & {id: string; revision: number; taskId?: string};
export type AppointmentErrors = Partial<Record<keyof AppointmentInput, string>>;
export const emptyAppointment = (date: string): AppointmentInput => ({title: "", date, allDay: true, startTime: "", endTime: "", location: "", notes: ""});
export function appointmentErrors(input: AppointmentInput): AppointmentErrors {
  const errors: AppointmentErrors = {};
  if (!input.title.trim() || input.title.trim().length > 200) errors.title = "Enter a title of up to 200 characters.";
  if (!isCanonicalDateOnly(input.date) || input.date < "1900-01-01" || input.date > "2199-12-31") errors.date = "Enter a real date as DD-MM-YYYY.";
  if (!input.allDay) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) errors.startTime = "Enter a start time.";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime)) errors.endTime = "Enter an end time.";
    else if (!errors.startTime && input.endTime <= input.startTime) errors.endTime = "End time must be after start time.";
  }
  if (input.location.trim().length > 300) errors.location = "Use up to 300 characters for the location.";
  if (input.notes.trim().length > 8000) errors.notes = "Use up to 8000 characters for notes.";
  return errors;
}
export function cleanAppointment(input: AppointmentInput): AppointmentInput {
  return {date: input.date, allDay: input.allDay, title: input.title.trim(), location: input.location.trim(), notes: input.notes.trim(), startTime: input.allDay ? "" : input.startTime, endTime: input.allDay ? "" : input.endTime};
}
export function appointmentCalendarEntry(record: MaintenanceAppointment): CalendarEntry {
  return {id: `maintenance:${record.id}`, type: "maintenance", title: record.title, date: record.date, time: record.allDay ? "" : record.startTime, section: "Group", path: `/calendar/maintenance/${encodeURIComponent(record.id)}`};
}
export function appointmentSavedPath(back: string, date: string) {
  const params = new URLSearchParams(back.split("?")[1] || "");
  params.set("month", date.slice(0, 7));
  if (!["all", "maintenance"].includes(params.get("type") || "all")) params.set("type", "maintenance");
  if (params.get("section") && params.get("section") !== "Group") params.delete("section");
  return `/calendar?${params}`;
}
