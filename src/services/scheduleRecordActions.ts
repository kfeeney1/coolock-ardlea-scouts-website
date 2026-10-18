import type { EventInput, EventRecord } from "./eventAdmin";
import { eventInput } from "./eventManagementLogic.ts";
import { scheduleToday } from "./scheduleSelection.ts";

/** Presentation only; canonical services and Rules remain authoritative. */
export function scheduleRecordActions(date: string, lifecycleEditable: boolean, authorised: boolean, today = scheduleToday()) {
  return { edit: authorised && lifecycleEditable && date >= today, copy: authorised };
}
export function eventCopyInput(source: EventRecord, startDate: string, endDate: string): EventInput {
  return {
    ...eventInput(source), status: "draft", startDate, endDate,
    audience: source.audience ?? { version: 2, mode: "members", semantics: "snapshot", sectionIds: [], memberIds: Object.keys(source.attendance), resolvedMemberIds: Object.keys(source.attendance) }
  };
}
