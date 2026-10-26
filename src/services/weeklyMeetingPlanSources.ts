import { decodeProgramme } from "./weeklyMeetingProgrammeText.ts";
function marked(value: unknown, marker: string): Record<string, unknown> | null {
  if (typeof value !== "string") return null;
  try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) && (parsed as Record<string, unknown>).marker === marker ? parsed as Record<string, unknown> : null; } catch { return null; }
}
/** Canonical marked saves supersede stale legacy fields, including deliberate empty values. */
export function weeklyMeetingPlanSources(data: Record<string, unknown>, legacy: { theme: string; programmeNotes: string; plannedActivities: string }) {
  const activities = marked(data.plannedActivities, "weekly-activities-v1");
  const badges = marked(data.plannedBadgework, "weekly-badgework-v1");
  const encoded = marked(data.programmeNotes, "weekly-programme-v1");
  const canonicalProgramme = encoded && typeof encoded.theme === "string" && typeof encoded.notes === "string" ? encoded : null;
  const programme = decodeProgramme(data.programmeNotes);
  return {
    activitySource: activities && Array.isArray(activities.items) ? data.plannedActivities : Array.isArray(data.activities) ? data.activities : typeof data.plannedActivities === "string" ? data.plannedActivities : legacy.plannedActivities,
    canonicalBadgework: !!(badges && badges.authoritative === true && Array.isArray(badges.items)),
    badgeworkSources: badges && badges.authoritative === true && Array.isArray(badges.items) ? { plannedBadgework: data.plannedBadgework } : data,
    theme: canonicalProgramme ? canonicalProgramme.theme as string : (typeof data.theme === "string" ? data.theme.trim() : "") || programme.theme || legacy.theme,
    programmeNotes: canonicalProgramme ? canonicalProgramme.notes as string : programme.programmeNotes || legacy.programmeNotes
  };
}
