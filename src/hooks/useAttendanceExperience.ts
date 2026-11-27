import { useEffect, useState } from "react";
import { watchAttendanceExperience, type AttendanceExperienceVersion, type ConfigurableExperience } from "../services/attendanceExperienceSettings";

/** Presentation only: callers retain canonical loading, scope and authorization. */
export function useExperienceVersion(experience: ConfigurableExperience = "attendanceExperience") {
  const [version, setVersion] = useState<AttendanceExperienceVersion | null>(null);
  useEffect(() => watchAttendanceExperience(setVersion, () => setVersion("existing"), experience), [experience]);
  return version;
}

export function useAttendanceExperience(experience?: ConfigurableExperience) {
  return useExperienceVersion(experience) === "redesigned";
}
