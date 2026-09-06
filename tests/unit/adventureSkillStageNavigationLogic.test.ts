import assert from "node:assert/strict";
import test from "node:test";

import { adventureSkills } from "../../src/data/adventureSkills/index.ts";
import type { MemberAdventureProgress } from "../../src/services/adventureSkillProgress.ts";
import {
  badgeworkStageNavigation,
  badgeworkStageNavigationLabel
} from "../../src/services/adventureSkillStageNavigationLogic.ts";

const camping = adventureSkills.find((skill) => skill.id === "camping")!;

function progress(memberId: string, requirementIds: string[] = [], awardedStages: number[] = []): MemberAdventureProgress {
  return {
    memberId,
    requirements: requirementIds.map((requirementId) => ({
      requirementId,
      skillId: "camping",
      stage: 1,
      sharedCompetencyKey: "",
      completedAt: null,
      completedBy: "leader-1",
      sourceType: "manual",
      sourceId: ""
    })),
    awards: awardedStages.map((stage) => ({ id: `camping-stage-${stage}`, skillId: "camping", stage, awardedAt: null, awardedBy: "leader-1" }))
  };
}

test("stage navigation distinguishes each single-child progress state", () => {
  const stageOneIds = camping.stages[0].requirements.map((requirement) => requirement.id);
  const partial = new Map([["member-1", progress("member-1", stageOneIds.slice(0, 1))]]);
  assert.equal(badgeworkStageNavigation(camping, ["member-1"], partial)[0].status, "in-progress");

  const complete = new Map([["member-1", progress("member-1", stageOneIds)]]);
  const completeSummary = badgeworkStageNavigation(camping, ["member-1"], complete)[0];
  assert.equal(completeSummary.status, "requirements-complete");
  assert.equal(badgeworkStageNavigationLabel(completeSummary), "Awaiting award");

  const awarded = new Map([["member-1", progress("member-1", stageOneIds, [1])]]);
  assert.equal(badgeworkStageNavigation(camping, ["member-1"], awarded)[0].status, "awarded");
  assert.equal(badgeworkStageNavigation(camping, ["member-1"], awarded)[1].status, "not-started");
});

test("stage navigation summarizes mixed progress across selected children", () => {
  const stageOneIds = camping.stages[0].requirements.map((requirement) => requirement.id);
  const mixed = new Map<string, MemberAdventureProgress>([
    ["member-1", progress("member-1", stageOneIds, [1])],
    ["member-2", progress("member-2", stageOneIds)],
    ["member-3", progress("member-3", stageOneIds.slice(0, 1))]
  ]);
  const summary = badgeworkStageNavigation(camping, ["member-1", "member-2", "member-3"], mixed)[0];

  assert.equal(summary.status, "in-progress");
  assert.equal(summary.startedMemberCount, 3);
  assert.equal(summary.completedMemberCount, 2);
  assert.equal(summary.awardedMemberCount, 1);
  assert.equal(badgeworkStageNavigationLabel(summary), "Awarded 1/3");
});
