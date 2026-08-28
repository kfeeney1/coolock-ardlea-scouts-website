import type { AdventureProgressSourceType } from "./adventureSkillProgressLogic.ts";

export type BadgeworkSourceContext = {
  sourceType: AdventureProgressSourceType;
  sourceId: string;
  memberIds: string[];
  returnTo: string;
};

const SOURCE_TYPES: AdventureProgressSourceType[] = ["manual", "weeklyMeeting", "event", "activity", "migration"];

function cleanId(value: string): string {
  return value.trim().slice(0, 200);
}

export function badgeworkSourceContextFromParams(params: URLSearchParams): BadgeworkSourceContext | null {
  const sourceType = params.get("sourceType") as AdventureProgressSourceType | null;
  const sourceId = cleanId(params.get("sourceId") ?? "");
  if (!sourceType || !SOURCE_TYPES.includes(sourceType) || sourceType === "manual" || sourceType === "migration" || !sourceId) return null;

  const memberIds = [...new Set((params.get("memberIds") ?? "")
    .split(",")
    .map(cleanId)
    .filter(Boolean))];
  const returnTo = params.get("returnTo")?.startsWith("/leader/") ? params.get("returnTo")! : sourceBacklink(sourceType, sourceId);
  return { sourceType, sourceId, memberIds, returnTo };
}

export function badgeworkSourceHref(context: Omit<BadgeworkSourceContext, "returnTo"> & { returnTo?: string }): string {
  const params = new URLSearchParams({
    sourceType: context.sourceType,
    sourceId: cleanId(context.sourceId)
  });
  const memberIds = [...new Set(context.memberIds.map(cleanId).filter(Boolean))];
  if (memberIds.length) params.set("memberIds", memberIds.join(","));
  if (context.returnTo?.startsWith("/leader/")) params.set("returnTo", context.returnTo);
  return `/leader/badgework?${params.toString()}`;
}

export function sourceBacklink(sourceType: AdventureProgressSourceType, sourceId: string): string {
  const id = encodeURIComponent(cleanId(sourceId));
  if (sourceType === "weeklyMeeting") return `/leader/weekly?meeting=${id}`;
  if (sourceType === "event" || sourceType === "activity") return `/leader/events?event=${id}`;
  return "/leader/badgework";
}

export function sourceLabel(sourceType: AdventureProgressSourceType): string {
  if (sourceType === "weeklyMeeting") return "Weekly Meeting";
  if (sourceType === "event") return "Event";
  if (sourceType === "activity") return "Activity";
  return "Badgework";
}
