import {hallInterval, type HallLocalInterval} from "./hallBookingTime.ts";
import {canonicalMemberSection} from "./memberSectionCore.mjs";

/** UI gate only. The event source transaction rereads canonical permissions. */
export function canWriteEventHall(profile: {role: string; sections: string[]} | null, section: string): boolean {
  return Boolean(profile && ["leader", "admin", "super-admin"].includes(profile.role) && (["admin", "super-admin"].includes(profile.role)
    || profile.sections.includes(section) || profile.sections.includes(canonicalMemberSection(section))));
}

/** Preserve source ownership even if a legacy interval needs reconciliation. */
export function eventHallMetadata(data: Record<string, unknown>): {hallResource?: "group-hall"; hallRevision?: number; hallInterval?: HallLocalInterval} {
  const metadata: ReturnType<typeof eventHallMetadata> = {};
  if (Number.isSafeInteger(data.hallRevision) && Number(data.hallRevision) >= 0) metadata.hallRevision = Number(data.hallRevision);
  if (data.hallResource !== "group-hall") return metadata;
  metadata.hallResource = "group-hall";
  const value = data.hallInterval as HallLocalInterval | undefined;
  try {
    if (!value || Object.keys(value).some(key => !["date", "startTime", "endDate", "endTime"].includes(key))) return metadata;
    hallInterval(value);
    metadata.hallInterval = {date: value.date, startTime: value.startTime, endDate: value.endDate, endTime: value.endTime};
  } catch { /* A malformed interval must not hide source ownership or unlock source dates. */ }
  return metadata;
}
