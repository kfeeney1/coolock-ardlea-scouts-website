export const ADVENTURE_SKILL_COLOURS: Readonly<Record<string, string>> = {
  camping: "#5B9D3B",
  backwoods: "#FF7A1A",
  pioneering: "#005C5F",
  emergencies: "#FF7A45",
  hillwalking: "#00A36C",
  "air-activities": "#0D8DC9",
  paddling: "#226EB5",
  rowing: "#06346F",
  sailing: "#0B6FB8",
  swimming: "#08A9C5"
};

export function adventureSkillColour(skillId: string): string {
  return ADVENTURE_SKILL_COLOURS[skillId] ?? "#6B7280";
}

export function highestAwardedLevelLabel(highestAwardedStage: number): string {
  return highestAwardedStage > 0 ? `Level ${highestAwardedStage}` : "Not started";
}

type SkillStageProgress = {
  stage: number;
  status: "not-started" | "in-progress" | "requirements-complete" | "awarded";
};

export function badgeworkSkillLevelLabel(
  highestAwardedStage: number,
  stages: readonly SkillStageProgress[]
): string {
  const earliestStartedStage = stages.find((stage) => stage.status === "in-progress");
  if (earliestStartedStage) return `Level ${earliestStartedStage.stage} started`;

  const earliestAwaitingAwardStage = stages.find((stage) => stage.status === "requirements-complete");
  if (earliestAwaitingAwardStage) return `Level ${earliestAwaitingAwardStage.stage} awaiting award`;

  return highestAwardedLevelLabel(highestAwardedStage);
}
