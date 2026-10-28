export type BadgeworkExperienceVersion = "existing" | "redesigned";

/** Missing, corrupt or future configuration always retains the existing experience. */
export function badgeworkVersion(data?: Record<string, unknown>): BadgeworkExperienceVersion {
  return data?.version === "redesigned" ? "redesigned" : "existing";
}
