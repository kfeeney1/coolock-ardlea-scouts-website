import { adventureSkillOverview } from "./adventureSkillOverviewLogic.ts";
import type { MemberAdventureProgress } from "./adventureSkillProgress.ts";

export type BadgeworkProgressFilter = "all" | "awaiting-award" | "in-progress" | "awarded" | "not-started";
export type BadgeworkLevelFilter = "all" | "1" | "2" | "3" | "4" | "5" | "6-plus";
export type BadgeworkExactLevelFilter = "all" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

export function matchesBadgeworkProgressFilter(
  progress: MemberAdventureProgress,
  skillId: string,
  filter: BadgeworkProgressFilter,
  exactLevel: BadgeworkExactLevelFilter = "all"
): boolean {
  if (filter === "all") return true;
  const skills = adventureSkillOverview(progress).filter((skill) => skillId === "all" || skill.skillId === skillId);
  const stages = skills.flatMap((skill) => skill.stages).filter((stage) => exactLevel === "all" || stage.stage === Number(exactLevel));
  if (stages.length === 0) return false;
  if (filter === "not-started") return stages.every((stage) => stage.status === "not-started");
  const targetStatus = filter === "awaiting-award" ? "requirements-complete" : filter;
  return stages.some((stage) => stage.status === targetStatus);
}

export function matchesBadgeworkLevelNumber(stage: number, filter: BadgeworkLevelFilter): boolean {
  if (filter === "all") return true;
  if (filter === "6-plus") return stage >= 6;
  return stage === Number(filter);
}

export function matchesBadgeworkLevelFilter(
  progress: MemberAdventureProgress,
  skillId: string,
  filter: BadgeworkLevelFilter
): boolean {
  if (filter === "all") return true;
  const skills = adventureSkillOverview(progress).filter((skill) => skillId === "all" || skill.skillId === skillId);
  return skills.some((skill) => skill.stages.some((stage) =>
    matchesBadgeworkLevelNumber(stage.stage, filter)
    && (stage.status === "requirements-complete" || stage.status === "awarded")
  ));
}

export function badgeworkProgressFilterCounts(
  memberIds: readonly string[],
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>,
  skillId: string,
  exactLevel: BadgeworkExactLevelFilter = "all"
): Record<BadgeworkProgressFilter, number> {
  const filters: BadgeworkProgressFilter[] = ["all", "awaiting-award", "in-progress", "awarded", "not-started"];
  return Object.fromEntries(filters.map((filter) => [filter, memberIds.filter((memberId) =>
    matchesBadgeworkProgressFilter(
      progressByMemberId.get(memberId) ?? { memberId, requirements: [], awards: [] },
      skillId,
      filter,
      exactLevel
    )
  ).length])) as Record<BadgeworkProgressFilter, number>;
}
