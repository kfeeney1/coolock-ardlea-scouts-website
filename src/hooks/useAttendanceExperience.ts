import { useEffect, useState } from "react";
import { watchAttendanceExperience, type AttendanceExperienceVersion } from "../services/attendanceExperienceSettings";

/** Presentation only: callers retain canonical loading, scope and authorization. */
export function useAttendanceExperience() {
  const [version, setVersion] = useState<AttendanceExperienceVersion>("existing");
  useEffect(() => watchAttendanceExperience(setVersion, () => setVersion("existing")), []);
  return version === "redesigned";
}
