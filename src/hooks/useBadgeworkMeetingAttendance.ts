import { useEffect, useState } from "react";
import { loadWeeklyMeetingBadgeworkAttendance } from "../services/weeklyTracker.ts";
import { applicationErrorMessage } from "../services/applicationErrors.ts";

/** Preserve the existing persisted attendance/closed-meeting boundary for both presentations. */
export function useBadgeworkMeetingAttendance(meetingSourceId: string | null, setSelectedIds: (ids: string[]) => void, setError: (message: string) => void) {
  const [meetingAttendance, setMeetingAttendance] = useState<{ sourceId: string; status: "open" | "closed"; presentMemberIds: Set<string> } | null>(null);
  useEffect(() => {
    if (!meetingSourceId) return;
    let active = true;
    void loadWeeklyMeetingBadgeworkAttendance(meetingSourceId).then((meeting) => {
      if (!active) return;
      if (meeting.status !== "open") {
        setMeetingAttendance({ sourceId: meetingSourceId, status: "closed", presentMemberIds: new Set() });
        setSelectedIds([]);
        setError("This Weekly Meeting is closed. Reopen it before recording badgework.");
        return;
      }
      setMeetingAttendance({ sourceId: meetingSourceId, status: "open", presentMemberIds: new Set(meeting.presentMemberIds) });
    }).catch((loadError) => {
      if (active) {
        setMeetingAttendance({ sourceId: meetingSourceId, status: "closed", presentMemberIds: new Set() });
        setSelectedIds([]);
        setError(applicationErrorMessage(loadError, "Unable to confirm which children are present at this Weekly Meeting.", "BadgeworkTracking", "Load persisted Weekly Meeting attendance"));
      }
    });
    return () => { active = false; };
  }, [meetingSourceId, setSelectedIds, setError]);

  const current = meetingSourceId && meetingAttendance?.sourceId === meetingSourceId ? meetingAttendance : null;
  return { meetingPresentMemberIds: current?.presentMemberIds ?? null, meetingAttendanceLoading: Boolean(meetingSourceId && !current) };
}
