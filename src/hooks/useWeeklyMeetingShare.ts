import { useEffect, useMemo, useState } from "react";
import type { WeeklyMeetingRecord } from "../services/weeklyTracker";
import { loadWeeklyMeetingAdventureBadgework } from "../services/adventureSkillProgress";
import { buildParentWeeklyMeetingProgramme, buildWeeklyMeetingWhatsAppUrl, mergeWeeklyMeetingShareBadgework } from "../services/weeklyMeetingProgramme";
import { applicationErrorMessage } from "../services/applicationErrors.ts";

function completedMeetingBadgework(meeting: WeeklyMeetingRecord): string[] {
  const seen = new Set<string>();
  const badges: string[] = [];
  for (const entry of meeting.entries) {
    if (entry.attendance !== "present") continue;
    for (const raw of entry.badges) {
      const name = raw.trim();
      const key = name.toLocaleLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      badges.push(name);
    }
  }
  return badges;
}

export function useWeeklyMeetingShare(meeting: WeeklyMeetingRecord | null) {
  const [adventureBadgework, setAdventureBadgework] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!meeting) {
      setAdventureBadgework([]);
      setError("");
      setLoading(false);
      return () => { active = false; };
    }
    const memberIds = meeting.entries.filter((entry) => entry.attendance === "present").map((entry) => entry.memberId);
    setLoading(true);
    setError("");
    void loadWeeklyMeetingAdventureBadgework(memberIds, meeting.id)
      .then((items) => { if (active) setAdventureBadgework(items); })
      .catch((cause) => {
        if (!active) return;
        setAdventureBadgework([]);
        setError(applicationErrorMessage(cause, "Unable to load completed Adventure Skills for meeting sharing.", "WeeklySectionTracker"));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [meeting?.id, meeting?.entries]);

  const url = useMemo(() => {
    if (!meeting) return "";
    const completedBadgework = [...completedMeetingBadgework(meeting), ...adventureBadgework];
    const programme = mergeWeeklyMeetingShareBadgework(buildParentWeeklyMeetingProgramme(meeting), completedBadgework);
    return buildWeeklyMeetingWhatsAppUrl(programme);
  }, [meeting, adventureBadgework]);

  return { url, loading, error };
}
