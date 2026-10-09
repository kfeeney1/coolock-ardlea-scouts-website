import { useEffect, useState } from "react";
import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { loadLeaderAttendance, saveLeaderAttendance } from "../services/leaderAttendance";
import type { LeaderAttendanceEntry } from "../services/leaderAttendance";
import type { WeeklyLeaderOption } from "../services/weeklyLeaderOptions";
import { mergeLeaderAttendanceRoster } from "../services/weeklyTrackerLogic";

export function useWeeklyLeaderAttendance(
  meetingId: string,
  section: string,
  options: WeeklyLeaderOption[],
  reportError: (message: string) => void
) {
  const [entries, setEntries] = useState<LeaderAttendanceEntry[]>([]);
  const [savedEntries, setSavedEntries] = useState<LeaderAttendanceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const hasChanges = JSON.stringify(entries) !== JSON.stringify(savedEntries);

  useEffect(() => {
    if (!meetingId) {
      setEntries([]);
      setSavedEntries([]);
      return;
    }
    let active = true;
    setLoading(true);
    void loadLeaderAttendance("weeklyMeetings", meetingId).then((saved) => {
      if (!active) return;
      const roster = mergeLeaderAttendanceRoster(options, [section], false, saved);
      setEntries(roster);
      setSavedEntries(roster);
    }).catch((error) => {
      if (active) reportError(applicationErrorMessage(error, "Unable to load leader attendance.", "WeeklySectionTracker"));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [meetingId, section, options, reportError]);

  const save = async (id: string) => {
    await saveLeaderAttendance("weeklyMeetings", id, entries);
    setSavedEntries(entries);
  };

  return { entries, setEntries, loading, hasChanges, save };
}
