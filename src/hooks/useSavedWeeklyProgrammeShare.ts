import { useRef, useState } from "react";
import type { WeeklyMeetingRecord } from "../services/weeklyTracker";
import { saveMeetingBeforeShare } from "../services/weeklyMeetingShareSnapshot";
import { loadWeeklyMeetingAdventureBadgework } from "../services/adventureSkillProgress";
import { applicationErrorMessage, UserFacingError } from "../services/applicationErrors";

export function useSavedWeeklyProgrammeShare(record: WeeklyMeetingRecord | null, save: (snapshot: WeeklyMeetingRecord) => Promise<boolean>) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const start = async () => {
    if (!record || inFlight.current) return;
    inFlight.current = true;
    setOpen(true); setBusy(true); setUrl(""); setError("");
    try {
      if (!navigator.onLine) throw new UserFacingError("You are offline. Reconnect before saving and sharing. Your edits are still here.");
      setUrl(await saveMeetingBeforeShare(record, save, loadWeeklyMeetingAdventureBadgework));
    } catch (cause) { setError(applicationErrorMessage(cause, "Unable to prepare programme sharing. Your meeting edits are retained. Try again.", "WeeklyMeetingShare")); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return { open, busy, url, error, start, close: () => { if (!inFlight.current) { setOpen(false); setUrl(""); } } };
}
