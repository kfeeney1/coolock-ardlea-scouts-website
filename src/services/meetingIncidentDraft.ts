import type { InjurySeverity, WeeklyInjury, WeeklyMeetingRecord } from "./weeklyTracker";
import { UserFacingError } from "./applicationErrors.ts";
export type IncidentDraft = { memberId: string; concern: string; severity: InjurySeverity; action: string; parentInformed: boolean };
export const emptyIncidentDraft = (): IncidentDraft => ({ memberId: "", concern: "", severity: "minor", action: "", parentInformed: false });
export const incidentDraftHasChanges = (draft: IncidentDraft) => JSON.stringify(draft) !== JSON.stringify(emptyIncidentDraft());
export function incidentFromDraft(record: WeeklyMeetingRecord, draft: IncidentDraft, recordedAt = new Date().toISOString()): WeeklyInjury {
  if (record.injuries.length >= 50) throw new UserFacingError("This meeting already contains the maximum 50 incidents. Your form is retained; record further details using the existing additional notes process.");
  if (draft.concern.trim().length > 2000 || draft.action.trim().length > 2000) throw new UserFacingError("Incident concern and action must each be at most 2000 characters. Your form is retained.");
  const member = record.entries.find(entry => entry.memberId === draft.memberId);
  if (!member || !draft.concern.trim()) throw new UserFacingError("Select a member and enter an injury / medical concern before adding or saving this incident. Your form is retained in Run.");
  if (!["minor", "moderate", "serious"].includes(draft.severity)) throw new UserFacingError("Select a valid incident severity.");
  return { memberId: member.memberId, memberName: member.memberName, concern: draft.concern.trim(), severity: draft.severity, actionTaken: draft.action, parentInformed: draft.parentInformed, recordedAt };
}
