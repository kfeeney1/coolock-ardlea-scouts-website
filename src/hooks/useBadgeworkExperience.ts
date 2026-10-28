import { useEffect, useState } from "react";
import { watchBadgeworkExperience, type BadgeworkExperienceVersion } from "../services/badgeworkExperienceSettings";

/** Choose once per visit. A live rollout must never remount or reset a recording draft. */
export function useBadgeworkExperience() {
  const [configured, setConfigured] = useState<BadgeworkExperienceVersion | null>(null);
  const [choice, setChoice] = useState<BadgeworkExperienceVersion | null>(null);
  useEffect(() => {
    const accept = (version: BadgeworkExperienceVersion) => {
      setConfigured(version); setChoice(current => current ?? version);
    };
    return watchBadgeworkExperience(accept, () => accept("existing"));
  }, []);
  return { ready: choice !== null, redesigned: choice === "redesigned", changed: choice !== null && configured !== null && choice !== configured };
}
