import { adventureSkills } from "../data/adventureSkills/index.ts";
import type { MemberRecord } from "./memberAdmin.ts";
import type { MemberAdventureProgress } from "./adventureSkillProgress.ts";
import { adventureSkillOverview, type AdventureStageOverviewStatus } from "./adventureSkillOverviewLogic.ts";
import { csvCell } from "./reportingLogic.ts";

const requirementStatus = (status: AdventureStageOverviewStatus) => status === "awarded" || status === "requirements-complete" ? "Complete" : status === "in-progress" ? "In progress" : "Not started";

export function adventureSkillProgressCsv(
  members: readonly MemberRecord[],
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>,
  skillId = "all"
): string {
  const header = ["Child", "Section", "Adventure Skill", "Stage", "Completed Points", "Total Points", "Requirements", "Award"];
  const rows = members.flatMap((member) => {
    const progress = progressByMemberId.get(member.id) ?? { memberId: member.id, requirements: [], awards: [] };
    return adventureSkillOverview(progress)
      .filter((summary) => skillId === "all" || summary.skillId === skillId)
      .flatMap((summary) => summary.stages.map((stage) => [
        member.displayName,
        member.section,
        summary.skillName,
        stage.stage,
        stage.completedRequirements,
        stage.totalRequirements,
        requirementStatus(stage.status),
        stage.status === "awarded" ? "Awarded" : "Not awarded"
      ].map(csvCell).join(",")));
  });
  return [header.map(csvCell).join(","), ...rows].join("\r\n");
}

export function badgeworkExportFilename(skillId: string, date = new Date()): string {
  const skill = adventureSkills.find((item) => item.id === skillId);
  const scope = skill?.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all-skills";
  return `badgework-progress-${scope}-${date.toISOString().slice(0, 10)}.csv`;
}
