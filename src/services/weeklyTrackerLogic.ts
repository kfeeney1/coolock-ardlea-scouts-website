import type { WeeklyActivityPlan, WeeklyBadgeworkPlan, WeeklyMeetingRecord, WeeklyMemberEntry } from "./weeklyTracker";

export type WeeklyMemberSummary = {
  memberId: string;
  memberName: string;
  meetingsRecorded: number;
  present: number;
  absent: number;
  unrecorded: number;
  attendanceRate: number | null;
  subsPaidTotal: number;
  badges: string[];
};

export function buildWeeklyMemberSummaries(records: WeeklyMeetingRecord[]): WeeklyMemberSummary[] {
  const summaries = new Map<string, WeeklyMemberSummary>();
  for (const record of records) {
    for (const entry of record.entries) {
      const current = summaries.get(entry.memberId) ?? {
        memberId: entry.memberId,
        memberName: entry.memberName,
        meetingsRecorded: 0,
        present: 0,
        absent: 0,
        unrecorded: 0,
        attendanceRate: null,
        subsPaidTotal: 0,
        badges: []
      };
      current.memberName = entry.memberName || current.memberName;
      current.meetingsRecorded += 1;
      if (entry.attendance === "present") current.present += 1;
      else if (entry.attendance === "absent") current.absent += 1;
      else current.unrecorded += 1;
      if (entry.subsPaid) current.subsPaidTotal += entry.subsAmount;
      current.badges = [...new Set([...current.badges, ...entry.badges])];
      summaries.set(entry.memberId, current);
    }
  }
  return [...summaries.values()]
    .map((summary) => {
      const recorded = summary.present + summary.absent;
      return { ...summary, attendanceRate: recorded === 0 ? null : Math.round((summary.present / recorded) * 100) };
    })
    .sort((a, b) => a.memberName.localeCompare(b.memberName));
}

export function newWeeklyEntry(memberId: string, memberName: string): WeeklyMemberEntry {
  return { memberId, memberName, attendance: "unrecorded", subsPaid: false, subsAmount: 0, badges: [] };
}

export function newActivityPlan(id = crypto.randomUUID()): WeeklyActivityPlan {
  return { id, activity: "", leader: "", notes: "", equipment: "", startTime: "", finishTime: "" };
}

export function newBadgeworkPlan(id = crypto.randomUUID()): WeeklyBadgeworkPlan {
  return { id, badge: "", notes: "" };
}

export function defaultActivityPlans(): WeeklyActivityPlan[] {
  return [newActivityPlan(), newActivityPlan()];
}

export function defaultBadgeworkPlans(): WeeklyBadgeworkPlan[] {
  return [newBadgeworkPlan()];
}
