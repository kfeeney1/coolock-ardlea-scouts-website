import type { AdventureSkill } from "../data/adventureSkills/index.ts";
import type { MemberAdventureProgress } from "./adventureSkillProgress.ts";
import { isStageRequirementComplete } from "./adventureSkillProgressLogic.ts";

export type BadgeworkStageNavigationStatus = "not-started" | "in-progress" | "requirements-complete" | "awarded";

export type BadgeworkStageNavigationSummary = {
  stage: number;
  status: BadgeworkStageNavigationStatus;
  startedMemberCount: number;
  completedMemberCount: number;
  awardedMemberCount: number;
  selectedMemberCount: number;
};

export function badgeworkStageNavigation(
  skill: AdventureSkill,
  selectedMemberIds: readonly string[],
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>
): BadgeworkStageNavigationSummary[] {
  return skill.stages.map((stage) => {
    let startedMemberCount = 0;
    let completedMemberCount = 0;
    let awardedMemberCount = 0;

    for (const memberId of selectedMemberIds) {
      const progress = progressByMemberId.get(memberId);
      const completedIds = new Set(progress?.requirements.map((requirement) => requirement.requirementId) ?? []);
      const completedRequirements = stage.requirements.filter((requirement) =>
        isStageRequirementComplete(completedIds, requirement.id)
      ).length;
      const awarded = progress?.awards.some((award) => award.skillId === skill.id && award.stage === stage.stage) ?? false;

      if (completedRequirements > 0 || awarded) startedMemberCount += 1;
      if (stage.requirements.length > 0 && completedRequirements === stage.requirements.length) completedMemberCount += 1;
      if (awarded) awardedMemberCount += 1;
    }

    const selectedMemberCount = selectedMemberIds.length;
    const status: BadgeworkStageNavigationStatus = selectedMemberCount > 0 && awardedMemberCount === selectedMemberCount
      ? "awarded"
      : selectedMemberCount > 0 && completedMemberCount === selectedMemberCount
        ? "requirements-complete"
        : startedMemberCount > 0
          ? "in-progress"
          : "not-started";

    return {
      stage: stage.stage,
      status,
      startedMemberCount,
      completedMemberCount,
      awardedMemberCount,
      selectedMemberCount
    };
  });
}

export function badgeworkStageNavigationLabel(summary: BadgeworkStageNavigationSummary): string {
  const { awardedMemberCount, completedMemberCount, selectedMemberCount, startedMemberCount, status } = summary;
  if (status === "awarded") return "Awarded";
  if (awardedMemberCount > 0) return `Awarded ${awardedMemberCount}/${selectedMemberCount}`;
  if (status === "requirements-complete") return "Awaiting award";
  if (completedMemberCount > 0) return `Complete ${completedMemberCount}/${selectedMemberCount}`;
  if (startedMemberCount > 0) return selectedMemberCount === 1 ? "In progress" : `Started ${startedMemberCount}/${selectedMemberCount}`;
  return "Not started";
}
