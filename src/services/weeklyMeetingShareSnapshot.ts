import type { WeeklyMeetingRecord } from "./weeklyTracker";
import { buildParentWeeklyMeetingProgramme, buildWeeklyMeetingWhatsAppUrl, mergeWeeklyMeetingShareBadgework } from "./weeklyMeetingProgramme.ts";
import { UserFacingError } from "./applicationErrors.ts";

function completedBadges(meeting: WeeklyMeetingRecord): string[] {
  const seen = new Set<string>();
  return meeting.entries.filter(entry => entry.attendance === "present").flatMap(entry => entry.badges).map(name => name.trim()).filter(name => {
    const key = name.toLocaleLowerCase();
    if (!name || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export function weeklyMeetingSnapshotShareUrl(meeting: WeeklyMeetingRecord, adventureBadgework: string[]) {
  return buildWeeklyMeetingWhatsAppUrl(mergeWeeklyMeetingShareBadgework(buildParentWeeklyMeetingProgramme(meeting), [...completedBadges(meeting), ...adventureBadgework]));
}
/** No link is prepared until all meeting and leader-attendance writes acknowledge this snapshot. */
export async function saveMeetingBeforeShare(meeting: WeeklyMeetingRecord, save: (snapshot: WeeklyMeetingRecord) => Promise<boolean>, loadBadgework: (memberIds: string[], meetingId: string) => Promise<string[]>) {
  const snapshot = structuredClone(meeting);
  if (!await save(snapshot)) throw new UserFacingError("The meeting could not be saved. Sharing is blocked and your edits are still here. Try again.");
  const badgework = await loadBadgework(snapshot.entries.filter(entry => entry.attendance === "present").map(entry => entry.memberId), snapshot.id);
  return weeklyMeetingSnapshotShareUrl(snapshot, badgework);
}
