import type { SubsRatePolicy } from "./subsLogic";

export function mapSubsPolicy(id: string, data: Record<string, unknown>): SubsRatePolicy | null {
  const period = typeof data.period === "string" ? data.period.trim() : "";
  if (!period) return null;
  const effectiveFrom = typeof data.effectiveFrom === "string" && data.effectiveFrom
    ? data.effectiveFrom
    : typeof data.periodStart === "string" ? data.periodStart : "";
  const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
  const rates = (value: unknown) => Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry) && entry >= 0)
    : [];
  return { id, period, effectiveFrom,
    periodStart: typeof data.periodStart === "string" ? data.periodStart : effectiveFrom,
    periodEnd: typeof data.periodEnd === "string" ? data.periodEnd : "",
    standardCents: number(data.standardCents), leaderChildCents: number(data.leaderChildCents), siblingCents: number(data.siblingCents),
    standardFamilyRatesCents: rates(data.standardFamilyRatesCents), leaderFamilyRatesCents: rates(data.leaderFamilyRatesCents),
    version: typeof data.version === "number" && Number.isInteger(data.version) && data.version > 0 ? data.version : 1 };
}
