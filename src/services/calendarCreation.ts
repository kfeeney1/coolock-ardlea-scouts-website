import { isCanonicalDateOnly } from "./weeklyMeetingProgrammeLogic.ts";
/** Navigation state is a hint only; canonical editors still validate every save. */
export function calendarCreationDate(state: unknown): string {
  const date = state && typeof state === "object" && "calendarDate" in state ? state.calendarDate : null;
  return typeof date === "string" && isCanonicalDateOnly(date) && date >= "1900-01-01" && date <= "2199-12-31" ? date : "";
}
