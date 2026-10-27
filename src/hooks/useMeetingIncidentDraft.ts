import { useEffect, useState } from "react";
import { emptyIncidentDraft, incidentDraftHasChanges, incidentFromDraft, type IncidentDraft } from "../services/meetingIncidentDraft";
import type { WeeklyMeetingRecord } from "../services/weeklyTracker";
export function useMeetingIncidentDraft(meetingId: string, enabled: boolean) {
  const [draft, setDraft] = useState(emptyIncidentDraft);
  const clear = () => setDraft(emptyIncidentDraft());
  useEffect(() => { setDraft(emptyIncidentDraft()); }, [meetingId]);
  const field = <K extends keyof IncidentDraft>(key: K) => (value: IncidentDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const dirty = enabled && incidentDraftHasChanges(draft);
  return { dirty, clear, include: (record: WeeklyMeetingRecord) => dirty ? { ...record, injuries: [...record.injuries, incidentFromDraft(record, draft)] } : record,
    fields: { injuryMemberId: draft.memberId, setInjuryMemberId: field("memberId"), injuryConcern: draft.concern, setInjuryConcern: field("concern"), injurySeverity: draft.severity, setInjurySeverity: field("severity"), injuryAction: draft.action, setInjuryAction: field("action"), injuryParentInformed: draft.parentInformed, setInjuryParentInformed: field("parentInformed") } };
}
