import type { MemberRecord } from "./memberAdmin.ts";
import type { MemberAdventureProgress } from "./adventureSkillProgress.ts";
import { adventureSkillOverview } from "./adventureSkillOverviewLogic.ts";

export type BadgeworkAwardCandidate = {
  memberId: string;
  memberName: string;
  section: string;
  skillId: string;
  skillName: string;
  stage: number;
};

export function badgeworkAwardCandidates(
  members: readonly MemberRecord[],
  progressByMemberId: ReadonlyMap<string, MemberAdventureProgress>
): BadgeworkAwardCandidate[] {
  return members.flatMap((member) => {
    const progress = progressByMemberId.get(member.id) ?? { memberId: member.id, requirements: [], awards: [] };
    return adventureSkillOverview(progress).flatMap((skill) => skill.stages
      .filter((stage) => stage.status === "requirements-complete")
      .map((stage) => ({
        memberId: member.id,
        memberName: member.displayName,
        section: member.section,
        skillId: skill.skillId,
        skillName: skill.skillName,
        stage: stage.stage
      })));
  }).sort((a, b) => a.section.localeCompare(b.section) || a.memberName.localeCompare(b.memberName) || a.skillName.localeCompare(b.skillName) || a.stage - b.stage);
}

export function groupAwardCandidates(candidates: readonly BadgeworkAwardCandidate[]) {
  const groups = new Map<string, { skillId: string; stage: number; memberIds: string[] }>();
  for (const candidate of candidates) {
    const key = `${candidate.skillId}:${candidate.stage}`;
    const current = groups.get(key) ?? { skillId: candidate.skillId, stage: candidate.stage, memberIds: [] };
    current.memberIds.push(candidate.memberId);
    groups.set(key, current);
  }
  return [...groups.values()];
}
