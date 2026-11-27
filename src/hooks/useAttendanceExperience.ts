import { useEffect, useState } from "react";
import { watchAttendanceExperience, type AttendanceExperienceVersion } from "../services/attendanceExperienceSettings";

/** Presentation only: callers retain canonical loading, scope and authorization. */
export function useExperienceVersion(experience: "attendanceExperience" | "reportsExperience" | "eventEditExperience" = "attendanceExperience") {
  const [version, setVersion] = useState<AttendanceExperienceVersion | null>(null);
  useEffect(() => watchAttendanceExperience(setVersion, () => setVersion("existing"), experience), [experience]);
  return version;
}

export function useAttendanceExperience(experience?: "attendanceExperience" | "reportsExperience" | "eventEditExperience") {
  return useExperienceVersion(experience) === "redesigned";
}
