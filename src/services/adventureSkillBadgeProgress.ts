import { adventureSkillsById } from "../data/adventureSkills/index.ts";
import type { AdventureStageOverview } from "./adventureSkillOverviewLogic.ts";

/** Presentation only: competency completion and an explicit award remain separate. */
export function adventureSkillBadgeProgress(skillId: string, progress: AdventureStageOverview) {
  const skill = adventureSkillsById.get(skillId);
  const stage = skill?.stages.find(item => item.stage === progress.stage);
  if (!skill || !stage) throw new Error(`Unknown Adventure Skill stage: ${skillId}/${progress.stage}`);
  const { completedRequirements: completed, totalRequirements: total, status } = progress;
  if (total !== stage.requirements.length || !Number.isInteger(completed) || completed < 0 || completed > total) {
    throw new Error("Badge progress must use canonical competency counts.");
  }
  const awarded = status === "awarded";
  const complete = total > 0 && completed === total;
  return {
    skillId,
    skillName: skill.name,
    stage: stage.stage,
    completed,
    total,
    // Historical awards retain their full-colour presentation even if their
    // original competency evidence is incomplete. Counts stay truthful.
    fillFraction: awarded ? 1 : total > 0 ? completed / total : 0,
    status: awarded ? "awarded" : complete ? "requirements-complete" : completed > 0 ? "in-progress" : "not-started",
    statusLabel: awarded ? "Awarded" : complete ? "Ready to award" : completed > 0 ? "In progress" : "Not started"
  };
}
