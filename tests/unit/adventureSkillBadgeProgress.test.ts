import assert from "node:assert/strict";
import test from "node:test";
import { adventureSkills } from "../../src/data/adventureSkills/index.ts";
import { adventureSkillOverview } from "../../src/services/adventureSkillOverviewLogic.ts";
import { parentAdventureSkillSummaries } from "../../src/services/parentAdventureSkillProgressLogic.ts";
import { adventureSkillBadgeProgress } from "../../src/services/adventureSkillBadgeProgress.ts";
import type { MemberAdventureProgress } from "../../src/services/adventureSkillProgress.ts";

const empty = (): MemberAdventureProgress => ({ memberId: "child", requirements: [], awards: [] });
test("all supported stages have zero canonical completion and matching parent semantics", () => {
  const progress = empty();
  const leader = adventureSkillOverview(progress);
  const parent = parentAdventureSkillSummaries(progress);
  for (const skill of leader) for (const stage of skill.stages) {
    const visual = adventureSkillBadgeProgress(skill.skillId, stage);
    assert.equal(visual.fillFraction, 0);
    assert.equal(visual.statusLabel, "Not started");
    assert.deepEqual(visual, adventureSkillBadgeProgress(skill.skillId, parent.find(item => item.skillId === skill.skillId)!.stages.find(item => item.stage === stage.stage)!));
  }
  assert.throws(() => adventureSkillBadgeProgress("swimming", { stage: 7, completedRequirements: 0, totalRequirements: 1, status: "not-started" }));
});
test("fraction uses competencies while historical award remains full and separate", () => {
  const total = adventureSkills[0].stages[0].requirements.length;
  const partial = { stage: 1, completedRequirements: 1, totalRequirements: total, status: "in-progress" as const };
  assert.equal(adventureSkillBadgeProgress("camping", partial).fillFraction, 1 / total);
  assert.equal(adventureSkillBadgeProgress("camping", { ...partial, completedRequirements: total }).statusLabel, "Ready to award");
  assert.equal(adventureSkillBadgeProgress("camping", { ...partial, status: "awarded" }).fillFraction, 1);
  assert.equal(adventureSkillBadgeProgress("camping", { ...partial, status: "awarded" }).completed, 1);
  assert.throws(() => adventureSkillBadgeProgress("camping", { ...partial, totalRequirements: 999 }));
});
test("canonical equivalent completion flows into badge count without duplicate counting", () => {
  const progress = empty();
  progress.requirements = [{ requirementId: "emergencies-stage-1-requirement-03", skillId: "emergencies", stage: 1, sharedCompetencyKey: "emergency-services-full", completedAt: null, completedBy: "leader", sourceType: "manual", sourceId: "" }];
  const camping = adventureSkillOverview(progress).find(item => item.skillId === "camping")!;
  const badge = adventureSkillBadgeProgress("camping", camping.stages[0]);
  assert.equal(badge.completed, 1);
  assert.equal(badge.fillFraction, 1 / camping.stages[0].totalRequirements);
  assert.equal(badge.statusLabel, "In progress");
});
