import assert from "node:assert/strict";
import test from "node:test";

import { adventureSkills } from "../../src/data/adventureSkills/index.ts";
import type { MemberAdventureProgress } from "../../src/services/adventureSkillProgress.ts";
import { badgeworkProgressFilterCounts, matchesBadgeworkLevelFilter, matchesBadgeworkLevelNumber, matchesBadgeworkProgressFilter } from "../../src/services/adventureSkillOverviewFilterLogic.ts";

const camping = adventureSkills.find((skill) => skill.id === "camping")!;

function progress(memberId: string, requirementIds: string[] = [], awardedStages: number[] = []): MemberAdventureProgress {
  return {
    memberId,
    requirements: requirementIds.map((requirementId) => {
      const stage = Number(requirementId.match(/stage-(\d+)/)?.[1] ?? 1);
      return { requirementId, skillId: "camping", stage, sharedCompetencyKey: "", completedAt: null, completedBy: "leader-1", sourceType: "manual", sourceId: "" };
    }),
    awards: awardedStages.map((stage) => ({ id: `camping-stage-${stage}`, skillId: "camping", stage, awardedAt: null, awardedBy: "leader-1" }))
  };
}

function stageRequirementIds(stage: number): string[] {
  return camping.stages[stage - 1].requirements.map((requirement) => requirement.id);
}

test("overview attention filters distinguish operational progress states and selected skill", () => {
  const stageOneIds = stageRequirementIds(1);
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

test("overview attention filters can target one exact level", () => {
  const levelOnePartial = progress("level-one-partial", stageRequirementIds(1).slice(0, 1));
  const levelTwoPartial = progress("level-two-partial", stageRequirementIds(2).slice(0, 1));
  const levelTwoAwaiting = progress("level-two-awaiting", stageRequirementIds(2));
  const levelTwoAwarded = progress("level-two-awarded", [], [2]);
  const untouched = progress("untouched");

  assert.equal(matchesBadgeworkProgressFilter(levelOnePartial, "camping", "in-progress", "1"), true);
  assert.equal(matchesBadgeworkProgressFilter(levelOnePartial, "camping", "in-progress", "2"), false);
  assert.equal(matchesBadgeworkProgressFilter(levelTwoPartial, "camping", "in-progress", "2"), true);
  assert.equal(matchesBadgeworkProgressFilter(levelTwoAwaiting, "camping", "awaiting-award", "2"), true);
  assert.equal(matchesBadgeworkProgressFilter(levelTwoAwarded, "camping", "awarded", "2"), true);
  assert.equal(matchesBadgeworkProgressFilter(untouched, "camping", "not-started", "2"), true);
  assert.equal(matchesBadgeworkProgressFilter(untouched, "swimming", "not-started", "7"), false);
});

test("level-achieved filter includes both awaiting-award and awarded stages", () => {
  const levelTwoAwaiting = progress("level-two-awaiting", stageRequirementIds(2));
  const levelTwoAwarded = progress("level-two-awarded", [], [2]);
  const levelTwoPartial = progress("level-two-partial", stageRequirementIds(2).slice(0, 1));

  assert.equal(matchesBadgeworkLevelFilter(levelTwoAwaiting, "camping", "2"), true);
  assert.equal(matchesBadgeworkLevelFilter(levelTwoAwarded, "camping", "2"), true);
  assert.equal(matchesBadgeworkLevelFilter(levelTwoPartial, "camping", "2"), false);
  assert.equal(matchesBadgeworkLevelFilter(levelTwoAwaiting, "swimming", "2"), false);
});

test("level 6+ matches every achieved stage from six upwards", () => {
  const levelSixAwarded = progress("level-six", [], [6]);
  const levelEightAwaiting = progress("level-eight", stageRequirementIds(8));
  const levelFiveAwarded = progress("level-five", [], [5]);

  assert.equal(matchesBadgeworkLevelFilter(levelSixAwarded, "camping", "6-plus"), true);
  assert.equal(matchesBadgeworkLevelFilter(levelEightAwaiting, "camping", "6-plus"), true);
  assert.equal(matchesBadgeworkLevelFilter(levelFiveAwarded, "camping", "6-plus"), false);
  assert.equal(matchesBadgeworkLevelNumber(6, "6-plus"), true);
  assert.equal(matchesBadgeworkLevelNumber(9, "6-plus"), true);
  assert.equal(matchesBadgeworkLevelNumber(5, "6-plus"), false);
});

test("overview attention counts can be scoped to members returned by the level filter", () => {
  const stageOneIds = stageRequirementIds(1);
  const map = new Map<string, MemberAdventureProgress>([
    ["complete", progress("complete", stageOneIds)],
    ["awarded", progress("awarded", stageOneIds, [1])],
    ["untouched", progress("untouched")]
  ]);
  const levelOneMemberIds = [...map.entries()].filter(([, memberProgress]) => matchesBadgeworkLevelFilter(memberProgress, "camping", "1")).map(([memberId]) => memberId);
  const counts = badgeworkProgressFilterCounts(levelOneMemberIds, map, "camping");

  assert.deepEqual(counts, { all: 2, "awaiting-award": 1, "in-progress": 0, awarded: 1, "not-started": 0 });
});

test("overview attention counts respect the exact level being inspected", () => {
  const map = new Map<string, MemberAdventureProgress>([
    ["level-one-started", progress("level-one-started", stageRequirementIds(1).slice(0, 1))],
    ["level-two-started", progress("level-two-started", stageRequirementIds(2).slice(0, 1))],
    ["level-two-awaiting", progress("level-two-awaiting", stageRequirementIds(2))],
    ["level-two-awarded", progress("level-two-awarded", [], [2])]
  ]);

  assert.deepEqual(badgeworkProgressFilterCounts([...map.keys()], map, "camping", "2"), {
    all: 4,
    "awaiting-award": 1,
    "in-progress": 1,
    awarded: 1,
    "not-started": 1
  });
});
