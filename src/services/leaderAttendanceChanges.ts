import type { LeaderAttendanceEntry } from "./leaderAttendance";

export function leaderAttendanceHasChanges(entries: LeaderAttendanceEntry[], saved: LeaderAttendanceEntry[]): boolean {
  return JSON.stringify(entries) !== JSON.stringify(saved);
}
