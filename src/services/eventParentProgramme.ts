import type { EventInput } from "./eventAdmin";
/** A read-only audience-safe view of its source event; never an editable calendar record. */
export function eventParentProgramme(eventId: string, input: EventInput) {
  return {eventId, title: input.title.trim().slice(0, 200), description: input.description.trim().slice(0, 3000),
    eventType: input.eventType.trim().slice(0, 80), section: input.section.trim().slice(0, 80),
    location: input.location.trim().slice(0, 300), startDate: input.startDate.trim(), endDate: input.endDate.trim(), status: input.status};
}
export function eventAudienceDates(input: Pick<EventInput, "startDate" | "endDate" | "status">) {
  return {startDate: input.startDate.trim(), endDate: input.endDate.trim(), programmeVisible: input.status !== "draft"};
}
