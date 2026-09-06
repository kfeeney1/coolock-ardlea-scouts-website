import assert from "node:assert/strict";
import test from "node:test";

import { adventureSkills } from "../../src/data/adventureSkills/index.ts";
import type { MemberAdventureProgress } from "../../src/services/adventureSkillProgress.ts";
import { badgeworkProgressFilterCounts, matchesBadgeworkProgressFilter } from "../../src/services/adventureSkillOverviewFilterLogic.ts";

const camping = adventureSkills.find((skill) => skill.id === "camping")!;

function progress(memberId: string, requirementIds: string[] = [], awardedStages: number[] = []): MemberAdventureProgress {
  return {
    memberId,
    requirements: requirementIds.map((requirementId) => ({ requirementId, skillId: "camping", stage: 1, sharedCompetencyKey: "", completedAt: null, completedBy: "leader-1", sourceType: "manual", sourceId: "" })),
    awards: awardedStages.map((stage) => ({ id: `camping-stage-${stage}`, skillId: "camping", stage, awardedAt: null, awardedBy: "leader-1" }))
  };
}

test("overview filters distinguish operational progress states and selected skill", () => {
  const stageOneIds = camping.stages[0].requirements.map((requirement) => requirement.id);
  const complete = progress("complete", stageOneIds);
  const awarded = progress("awarded", stageOneIds, [1]);
  const partial = progress("partial", stageOneIds.slice(0, 1));
  const untouched = progress("untouched");

  assert.equal(matchesBadgeworkProgressFilter(complete, "camping", "awaiting-award"), true);
  assert.equal(matchesBadgeworkProgressFilter(awarded, "camping", "awarded"), true);
  assert.equal(matchesBadgeworkProgressFilter(partial, "camping", "in-progress"), true);
  assert.equal(matchesBadgeworkProgressFilter(untouched, "camping", "not-started"), true);
  assert.equal(matchesBadgeworkProgressFilter(complete, "swimming", "awaiting-award"), false);
});

test("overview filter counts support quick attention filters", () => {
  const stageOneIds = camping.stages[0].requirements.map((requirement) => requirement.id);
  const map = new Map<string, MemberAdventureProgress>([
    ["complete", progress("complete", stageOneIds)],
    ["awarded", progress("awarded", stageOneIds, [1])],
    ["untouched", progress("untouched")]
  ]);
  const counts = badgeworkProgressFilterCounts(["complete", "awarded", "untouched"], map, "camping");

  assert.deepEqual(counts, { all: 3, "awaiting-award": 1, "in-progress": 0, awarded: 1, "not-started": 1 });
});
