import type { WeeklyActivityPlan, WeeklyBadgeworkPlan, WeeklyMeetingRecord, WeeklyMemberEntry } from "./weeklyTracker";
import type { LeaderAttendanceEntry } from "./leaderAttendance";
import type { WeeklyLeaderOption } from "./weeklyLeaderOptions";
import { formatSiteDate } from "./siteDateFormat.ts";

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

export type WeeklyMeetingHistoryFilters = {
  search: string;
  section: string;
  fromDate: string;
  toDate: string;
};

export function filterWeeklyMeetingHistory(records: WeeklyMeetingRecord[], filters: WeeklyMeetingHistoryFilters): WeeklyMeetingRecord[] {
  const search = filters.search.trim().toLocaleLowerCase();
  return records.filter((record) => {
    if (filters.section && filters.section !== "all" && record.section !== filters.section) return false;
    if (filters.fromDate && record.meetingDate < filters.fromDate) return false;
    if (filters.toDate && record.meetingDate > filters.toDate) return false;
    if (!search) return true;
    const searchable = [
      record.section,
      record.meetingDate,
      record.location,
      record.theme,
      record.programmeNotes,
      record.notes,
      ...record.activities.flatMap((activity) => [activity.activity, activity.leader, activity.equipment]),
      ...record.badgeworkPlan.flatMap((badgework) => [badgework.badge, badgework.leader, badgework.equipment])
    ].join(" ").toLocaleLowerCase();
    return searchable.includes(search);
  });
}

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

export type WeeklyRosterMember = { id: string; displayName: string; section: string; sections?: string[]; status: string };

const rosterCollator = new Intl.Collator("en-IE", { sensitivity: "base", numeric: true, usage: "sort" });

export function mergeLeaderAttendanceRoster(options: WeeklyLeaderOption[], selectedSections: string[], groupWide: boolean, saved: LeaderAttendanceEntry[] = []): LeaderAttendanceEntry[] {
  const relevant = new Set(groupWide ? ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"] : selectedSections);
  const entries = new Map<string, LeaderAttendanceEntry>();
  for (const leader of options) {
    if (!relevant.has(leader.organisationSection)) continue;
    const entry = entries.get(leader.id) ?? { leaderUid: leader.id, displayName: leader.displayName, appointments: [], sections: [], attendance: "unrecorded" as const };
    entry.appointments = [...new Set([...entry.appointments, leader.scoutingRole])];
    entry.sections = [...new Set([...entry.sections, leader.organisationSection])];
    entries.set(leader.id, entry);
  }
  for (const entry of saved) {
    const current = entries.get(entry.leaderUid);
    const identity = options.filter((option) => option.id === entry.leaderUid);
    if (!current && identity.length === 0) continue;
    const latest = identity.length > 0 ? {
      leaderUid: entry.leaderUid,
      displayName: identity[0].displayName,
      appointments: [...new Set(identity.map((option) => option.scoutingRole))],
      sections: [...new Set(identity.map((option) => option.organisationSection))],
      attendance: entry.attendance
    } : { ...current!, attendance: entry.attendance };
    entries.set(entry.leaderUid, current ? { ...current, attendance: entry.attendance } : latest);
  }
  return [...entries.values()].sort((a, b) => rosterCollator.compare(a.displayName, b.displayName) || a.leaderUid.localeCompare(b.leaderUid));
}

export function sortWeeklyEntries(entries: WeeklyMemberEntry[]): WeeklyMemberEntry[] {
  return [...entries].sort((a, b) => rosterCollator.compare(a.memberName.trim(), b.memberName.trim()) || a.memberId.localeCompare(b.memberId));
}

export function reconcileOpenWeeklyRoster(entries: WeeklyMemberEntry[], members: WeeklyRosterMember[], section: string): WeeklyMemberEntry[] {
  const byId = new Map(entries.map((entry) => [entry.memberId, entry] as const));
  for (const member of members) {
    const memberships = new Set([member.section, ...(member.sections ?? [])]);
    if (member.status !== "active" || !memberships.has(section) || byId.has(member.id)) continue;
    byId.set(member.id, newWeeklyEntry(member.id, member.displayName));
  }
  return sortWeeklyEntries([...byId.values()]);
}

export function newWeeklyEntry(memberId: string, memberName: string): WeeklyMemberEntry {
  return { memberId, memberName, attendance: "unrecorded", uniform: false, subsPaid: false, subsAmount: 0, badges: [] };
}

export function newActivityPlan(id: string = crypto.randomUUID()): WeeklyActivityPlan {
  return { id, activity: "", leader: "", notes: "", equipment: "", durationMinutes: 0 };
}

export function newBadgeworkPlan(id: string = crypto.randomUUID()): WeeklyBadgeworkPlan {
  return { id, badge: "", leader: "", notes: "", equipment: "", durationMinutes: 0 };
}


export function decodeWeeklyBadgeworkSources(data: Record<string, unknown>, legacyPlannedBadgework = ""): WeeklyBadgeworkPlan[] {
  const candidates = [data.badgeworkPlan, data.plannedBadgework, data.badgework, legacyPlannedBadgework];
  const plans: WeeklyBadgeworkPlan[] = [];
  const seen = new Set<string>();

  const append = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(append);
      return;
    }
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) return;
      try {
        const parsed: unknown = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          const object = parsed as Record<string, unknown>;
          if (Array.isArray(object.items)) {
            append(object.items);
            return;
          }
          if (["weekly-badgework-v1", "weekly-plan-v1"].includes(String(object.marker ?? ""))) return;
          append(object);
          return;
        }
      } catch {
        // Older records stored a single Badgework name as plain text.
      }
      append({ badge: text });
      return;
    }
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if (Array.isArray(item.items)) {
      append(item.items);
      return;
    }
    const badge = [item.badge, item.name, item.badgeName, item.activity, item.title]
      .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)?.trim() ?? "";
    if (!badge) {
      if (typeof item.badge === "string" && !item.badge.trim() && !plans.some((plan) => plan.badge === "")) {
        plans.push({
          id: typeof item.id === "string" && item.id ? item.id : `legacy-badgework-${plans.length + 1}`,
          badge: "",
          leader: typeof item.leader === "string" ? item.leader : "",
          notes: typeof item.notes === "string" ? item.notes : "",
          equipment: typeof item.equipment === "string" ? item.equipment : "",
          durationMinutes: typeof item.durationMinutes === "number" && Number.isFinite(item.durationMinutes)
            ? Math.max(0, Math.min(360, Math.round(item.durationMinutes)))
            : 0
        });
      }
      return;
    }
    const key = badge.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    plans.push({
      id: typeof item.id === "string" && item.id ? item.id : `legacy-badgework-${plans.length + 1}`,
      badge,
      leader: typeof item.leader === "string" ? item.leader : "",
      notes: typeof item.notes === "string" ? item.notes : "",
      equipment: typeof item.equipment === "string" ? item.equipment : "",
      durationMinutes: typeof item.durationMinutes === "number" && Number.isFinite(item.durationMinutes)
        ? Math.max(0, Math.min(360, Math.round(item.durationMinutes)))
        : 0
    });
  };

  candidates.forEach(append);
  return plans;
}

export function defaultActivityPlans(): WeeklyActivityPlan[] {
  return [newActivityPlan(), newActivityPlan()];
}

export function defaultBadgeworkPlans(): WeeklyBadgeworkPlan[] {
  return [newBadgeworkPlan()];
}

export function totalProgrammeDuration(activities: WeeklyActivityPlan[], badgework: WeeklyBadgeworkPlan[]): number {
  return [...activities, ...badgework].reduce((total, item) => total + Math.max(0, Number(item.durationMinutes) || 0), 0);
}

export function weeklyMeetingHasChanges(current: WeeklyMeetingRecord | null, saved: WeeklyMeetingRecord | null): boolean {
  if (!current || !saved || current.id !== saved.id) return false;
  return JSON.stringify(current) !== JSON.stringify(saved);
}


export const displayWeeklyDate=(value:string)=>formatSiteDate(value);
export const initialWeeklyStep=(value:string)=>value>new Date().toISOString().slice(0,10)?"programme":"attendance";
export const splitWeeklyLeaders=(value:string)=>value==="All leaders"?[value]:value.split(" | ").map(v=>v.trim()).filter(Boolean);
export const joinWeeklyLeaders=(values:string[])=>[...new Set(values.map(v=>v.trim()).filter(Boolean))].join(" | ");
export const nonNegativeWeeklyNumber=(value:string)=>value===""?0:Math.max(0,Number(value)||0);


export function sortOpenWeeklyMeetings(records: WeeklyMeetingRecord[]): WeeklyMeetingRecord[] {
  const validDate = /^\d{4}-\d{2}-\d{2}$/;
  return [...records].sort((a, b) => {
    const aValid = validDate.test(a.meetingDate);
    const bValid = validDate.test(b.meetingDate);
    if (aValid !== bValid) return aValid ? -1 : 1;
    const byDate = a.meetingDate.localeCompare(b.meetingDate);
    return byDate || a.section.localeCompare(b.section) || a.id.localeCompare(b.id);
  });
}
