import type { EventReportRecord } from "./reportingLogic.ts";

export function recordedEventConsent(event: EventReportRecord) {
  if (!event.consentRequired) return [];
  const roster = new Set([...Object.keys(event.attendance), ...Object.keys(event.consent)]);
  return [...roster].filter(id => event.attendance[id] !== "not-attending" && event.consent[id] !== "not-required")
    .map(id => ({ id, received: event.consent[id] === "received" }));
}
