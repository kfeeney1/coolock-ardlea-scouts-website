import assert from "node:assert/strict";
import test from "node:test";

import { adventureSkills } from "../../src/data/adventureSkills/index.ts";
import { adventureSkillOverview } from "../../src/services/adventureSkillOverviewLogic.ts";
import type { MemberAdventureProgress } from "../../src/services/adventureSkillProgress.ts";

const emptyProgress = (): MemberAdventureProgress => ({ memberId: "member-1", requirements: [], awards: [] });

test("overview identifies untouched skills and starts at stage one", () => {
  const camping = adventureSkillOverview(emptyProgress()).find((skill) => skill.skillId === "camping")!;
  assert.equal(camping.status, "not-started");
  assert.equal(camping.nextStage, 1);
  assert.equal(camping.highestAwardedStage, 0);
});

test("overview distinguishes partial, complete, and awarded stage states", () => {
  const camping = adventureSkills.find((skill) => skill.id === "camping")!;
  const stageOne = camping.stages[0];
  const progress = emptyProgress();
  progress.requirements = stageOne.requirements.map((requirement) => ({
    requirementId: requirement.id,
    skillId: camping.id,
    stage: 1,
    sharedCompetencyKey: requirement.sharedCompetencyKey ?? "",
    completedAt: null,
    completedBy: "leader-1",
    sourceType: "manual",
    sourceId: ""
  }));

  let summary = adventureSkillOverview(progress).find((skill) => skill.skillId === "camping")!;
  assert.equal(summary.stages[0].status, "requirements-complete");
  assert.equal(summary.status, "requirements-complete");
  assert.equal(summary.nextStage, 1);

  progress.awards = [{ id: "camping-stage-1", skillId: "camping", stage: 1, awardedAt: null, awardedBy: "leader-1" }];
  summary = adventureSkillOverview(progress).find((skill) => skill.skillId === "camping")!;
  assert.equal(summary.stages[0].status, "awarded");
  assert.equal(summary.highestAwardedStage, 1);
  assert.equal(summary.nextStage, 2);
});

test("overview reports a partially completed current stage", () => {
  const camping = adventureSkills.find((skill) => skill.id === "camping")!;
  const requirement = camping.stages[0].requirements[0];
  const progress = emptyProgress();
  progress.requirements = [{
    requirementId: requirement.id,
    skillId: camping.id,
    stage: 1,
    sharedCompetencyKey: requirement.sharedCompetencyKey ?? "",
    completedAt: null,
    completedBy: "leader-1",
    sourceType: "manual",
    sourceId: ""
  }];
  const summary = adventureSkillOverview(progress).find((skill) => skill.skillId === "camping")!;
  assert.equal(summary.status, "in-progress");
  assert.equal(summary.stages[0].completedRequirements, 1);
});
