export type EventLifecycleStatus = "draft" | "open" | "closed" | "completed";

export type EventCloseOutInput = {
  status: EventLifecycleStatus;
  consentRequired: boolean;
  attendance: Record<string, string>;
  consent: Record<string, string>;
};

const TRANSITIONS: Record<EventLifecycleStatus, EventLifecycleStatus[]> = {
  draft: ["draft", "open"],
  open: ["open", "draft", "closed"],
  closed: ["closed", "open", "completed"],
  completed: ["completed"],
};

export function allowedEventStatuses(current: EventLifecycleStatus): EventLifecycleStatus[] {
  return TRANSITIONS[current];
}

export function canTransitionEventStatus(from: EventLifecycleStatus, to: EventLifecycleStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function eventCloseOutIssues(input: EventCloseOutInput): string[] {
  const issues: string[] = [];
  const attendanceValues = Object.values(input.attendance);
  const consentValues = Object.values(input.consent);

  if (input.status !== "closed") issues.push("Event must be Closed before it can be completed.");
  if (attendanceValues.length === 0) issues.push("Record the event roster before completing the event.");
  if (attendanceValues.some((value) => value === "invited")) issues.push("Resolve all invited attendance entries before completing the event.");
  if (input.consentRequired && consentValues.some((value) => value === "required")) issues.push("Resolve all outstanding consent entries before completing the event.");

  return issues;
}

export function eventCloseOutReady(input: EventCloseOutInput): boolean {
  return eventCloseOutIssues(input).length === 0;
}
