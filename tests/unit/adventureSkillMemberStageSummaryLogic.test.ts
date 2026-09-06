import assert from "node:assert/strict";
import test from "node:test";

import { adventureSkills } from "../../src/data/adventureSkills/index.ts";
import type { MemberAdventureProgress } from "../../src/services/adventureSkillProgress.ts";
import { memberStageSummary, memberStageSummaryLabel } from "../../src/services/adventureSkillMemberStageSummaryLogic.ts";

const camping = adventureSkills.find((skill) => skill.id === "camping")!;
const stageOne = camping.stages[0];

function progress(requirementIds: string[] = [], awarded = false): MemberAdventureProgress {
  return {
    memberId: "member-1",
    requirements: requirementIds.map((requirementId) => ({
      requirementId,
      skillId: camping.id,
      stage: 1,
      sharedCompetencyKey: "",
      completedAt: null,
      completedBy: "leader-1",
      sourceType: "manual",
      sourceId: ""
    })),
    awards: awarded ? [{ id: "camping-stage-1", skillId: camping.id, stage: 1, awardedAt: null, awardedBy: "leader-1" }] : []
  };
}

test("member stage summary distinguishes not-started, partial, complete and awarded states", () => {
  const ids = stageOne.requirements.map((requirement) => requirement.id);

  const notStarted = memberStageSummary("member-1", progress(), camping, stageOne);
  assert.equal(notStarted.status, "not-started");
  assert.equal(memberStageSummaryLabel(notStarted), `0/${ids.length} points`);

  const partial = memberStageSummary("member-1", progress(ids.slice(0, 2)), camping, stageOne);
  assert.equal(partial.status, "in-progress");
  assert.equal(memberStageSummaryLabel(partial), `2/${ids.length} points`);

  const complete = memberStageSummary("member-1", progress(ids), camping, stageOne);
  assert.equal(complete.status, "requirements-complete");
  assert.equal(memberStageSummaryLabel(complete), "Awaiting award");

  const awarded = memberStageSummary("member-1", progress(ids, true), camping, stageOne);
  assert.equal(awarded.status, "awarded");
  assert.equal(memberStageSummaryLabel(awarded), "Awarded");
});
