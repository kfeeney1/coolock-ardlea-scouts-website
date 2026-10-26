import { useEffect, useState } from "react";
import { watchMeetingExperience } from "../services/meetingExperienceSettings";

type Choice = { scope: string; redesigned: boolean };
/** Pin presentation for one editor visit, including saves. Never remount an active draft on rollout. */
export function useMeetingExperience(scope = "") {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  useEffect(() => watchMeetingExperience(v => setConfigured(v === "redesigned"), () => setConfigured(false)), []);
  const pinned = choice?.scope === scope ? choice : null;
  useEffect(() => {
    if (!scope) setChoice(null);
    else if (!pinned && configured !== null) setChoice({ scope, redesigned: configured });
  }, [scope, configured, pinned]);
  return {
    ready: scope ? Boolean(pinned) : configured !== null,
    redesigned: pinned?.redesigned ?? configured === true,
    changed: Boolean(pinned && configured !== null && pinned.redesigned !== configured),
  };
}
