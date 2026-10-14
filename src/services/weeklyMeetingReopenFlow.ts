import type { WeeklyMeetingRecord } from "./weeklyTracker.ts";

/** Reopen persistence is the navigation gate; audit reporting is secondary. */
export async function reopenWeeklyMeetingAndNavigate(
  record: WeeklyMeetingRecord,
  reopen: (id: string) => Promise<void>,
  navigate: (path: string) => void,
  audit: (record: WeeklyMeetingRecord) => Promise<void>,
  onAuditFailure: (error: unknown) => void
): Promise<void> {
  await reopen(record.id);
  navigate(`/leader/weekly?meeting=${encodeURIComponent(record.id)}`);
  void Promise.resolve().then(() => audit(record)).catch(onAuditFailure);
}
