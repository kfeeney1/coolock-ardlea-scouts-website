import { adventureSkillOverview } from "./adventureSkillOverviewLogic.ts";
import type { MemberAdventureProgress } from "./adventureSkillProgress.ts";

export type BadgeworkProgressFilter = "all" | "awaiting-award" | "in-progress" | "awarded" | "not-started";

export function matchesBadgeworkProgressFilter(
  progress: MemberAdventureProgress,
  skillId: string,
  filter: BadgeworkProgressFilter
): boolean {
  if (filter === "all") return true;
  const skills = adventureSkillOverview(progress).filter((skill) => skillId === "all" || skill.skillId === skillId);
  if (filter === "not-started") return skills.every((skill) => skill.stages.every((stage) => stage.status === "not-started"));
  const targetStatus = filter === "awaiting-award" ? "requirements-complete" : filter;
  return skills.some((skill) => skill.stages.some((stage) => stage.status === targetStatus));
}

export function badgeworkProgressFilterCounts(
  memberIds: readonly string[],
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>,
  skillId: string
): Record<BadgeworkProgressFilter, number> {
  const filters: BadgeworkProgressFilter[] = ["all", "awaiting-award", "in-progress", "awarded", "not-started"];
  return Object.fromEntries(filters.map((filter) => [filter, memberIds.filter((memberId) =>
    matchesBadgeworkProgressFilter(
      progressByMemberId.get(memberId) ?? { memberId, requirements: [], awards: [] },
      skillId,
      filter
    )
  ).length])) as Record<BadgeworkProgressFilter, number>;
}
