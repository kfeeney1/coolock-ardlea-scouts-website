import test from "node:test";
import assert from "node:assert/strict";

import { adventureSkills } from "../../src/data/adventureSkills/index.ts";
import { badgeworkAwardCandidates, groupAwardCandidates } from "../../src/services/adventureSkillAwardQueueLogic.ts";
import type { MemberRecord } from "../../src/services/memberAdmin.ts";
import type { MemberAdventureProgress } from "../../src/services/adventureSkillProgress.ts";

const skill = adventureSkills[0]!;
const stage = skill.stages[0]!;
const member = { id: "member-1", displayName: "Alex Scout", section: "Cubs", status: "active" } as MemberRecord;

function completeProgress(awarded = false): MemberAdventureProgress {
  return {
    memberId: member.id,
    requirements: stage.requirements.map((requirement) => ({
      requirementId: requirement.id,
      skillId: skill.id,
      stage: stage.stage,
      sharedCompetencyKey: requirement.sharedCompetencyKey ?? "",
      completedAt: null,
      completedBy: "leader-1",
      sourceType: "manual",
      sourceId: ""
    })),
    awards: awarded ? [{ id: `${skill.id}-stage-${stage.stage}`, skillId: skill.id, stage: stage.stage, awardedAt: null, awardedBy: "leader-1" }] : []
  };
}

test("award queue contains only fully complete unawarded stages", () => {
  const ready = badgeworkAwardCandidates([member], new Map([[member.id, completeProgress(false)]]));
  assert.ok(ready.some((candidate) => candidate.memberId === member.id && candidate.skillId === skill.id && candidate.stage === stage.stage));

  const awarded = badgeworkAwardCandidates([member], new Map([[member.id, completeProgress(true)]]));
  assert.equal(awarded.some((candidate) => candidate.skillId === skill.id && candidate.stage === stage.stage), false);
});

test("award queue excludes partial progress", () => {
  const progress = completeProgress(false);
  progress.requirements = progress.requirements.slice(0, -1);
  const candidates = badgeworkAwardCandidates([member], new Map([[member.id, progress]]));
  assert.equal(candidates.some((candidate) => candidate.skillId === skill.id && candidate.stage === stage.stage), false);
});

test("award candidates group identical skill stages for efficient writes", () => {
  const groups = groupAwardCandidates([
    { memberId: "a", memberName: "A", section: "Cubs", skillId: "camping", skillName: "Camping", stage: 1 },
    { memberId: "b", memberName: "B", section: "Cubs", skillId: "camping", skillName: "Camping", stage: 1 },
    { memberId: "c", memberName: "C", section: "Scouts", skillId: "camping", skillName: "Camping", stage: 2 }
  ]);
  assert.deepEqual(groups, [
    { skillId: "camping", stage: 1, memberIds: ["a", "b"] },
    { skillId: "camping", stage: 2, memberIds: ["c"] }
  ]);
});
