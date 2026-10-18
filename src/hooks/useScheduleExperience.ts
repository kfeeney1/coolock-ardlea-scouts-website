import { useEffect, useState } from "react";
import { watchScheduleExperience, type ScheduleExperienceVersion } from "../services/scheduleExperienceSettings";

/** Presentation only: callers retain canonical loading, scope and authorization. */
export function useScheduleExperience() {
  const [version, setVersion] = useState<ScheduleExperienceVersion>("existing");
  useEffect(() => watchScheduleExperience(setVersion, () => setVersion("existing")), []);
  return version === "redesigned";
}
