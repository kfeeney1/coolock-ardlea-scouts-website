import assert from "node:assert/strict";
import test from "node:test";

import { adventureSkills } from "../../src/data/adventureSkills/index.ts";
import { adventureCatalogueContract, validateAdventureIntegrity } from "../../scripts/firestore-adventure-integrity.mjs";

const timestamp = { toDate: () => new Date("2026-09-01T00:00:00Z") };
const catalogue = adventureCatalogueContract(adventureSkills);
const stage = adventureSkills[0].stages[0];

function requirementRecords(memberId = "member1") {
  return stage.requirements.map((requirement) => ({
    id: requirement.id,
    memberId,
    path: `memberAdventureSkillProgress/${memberId}/requirements/${requirement.id}`,
    data: { memberId, requirementId: requirement.id, skillId: adventureSkills[0].id, stage: stage.stage, sharedCompetencyKey: requirement.sharedCompetencyKey ?? "", completedAt: timestamp, completedBy: "leader1", sourceType: "weeklyMeeting", sourceId: "weekly1" }
  }));
}

test("accepts canonical nested progress and an eligible stable award", () => {
  const memberId = "member1";
  const awardId = `${adventureSkills[0].id}-stage-${stage.stage}`;
  const errors = validateAdventureIntegrity({
    members: new Map([[memberId, {}]]), weeklyMeetings: new Map([["weekly1", {}]]), events: new Map(),
    requirements: requirementRecords(memberId),
    awards: [{ id: awardId, memberId, path: `memberAdventureSkillProgress/${memberId}/awards/${awardId}`, data: { awardId, memberId, skillId: adventureSkills[0].id, stage: stage.stage, awardedAt: timestamp, awardedBy: "leader1" } }],
    catalogue
  });
  assert.deepEqual(errors, []);
});

test("reports orphaned, non-canonical and prematurely awarded progress", () => {
  const requirements = requirementRecords("missing-member").slice(0, 1);
  requirements[0].data.skillId = "wrong-skill";
  requirements[0].data.sourceId = "missing-weekly";
  const awardId = `${adventureSkills[0].id}-stage-${stage.stage}`;
  const errors = validateAdventureIntegrity({ members: new Map(), weeklyMeetings: new Map(), events: new Map(), requirements,
    awards: [{ id: "wrong-id", memberId: "missing-member", path: "memberAdventureSkillProgress/missing-member/awards/wrong-id", data: { awardId, memberId: "missing-member", skillId: adventureSkills[0].id, stage: stage.stage, awardedAt: timestamp, awardedBy: "leader1" } }], catalogue });
  assert.ok(errors.some((error: string) => error.includes("parent member")));
  assert.ok(errors.some((error: string) => error.includes("canonical requirement")));
  assert.ok(errors.some((error: string) => error.includes("references no weekly meeting")));
  assert.ok(errors.some((error: string) => error.includes("document id must be")));
  assert.ok(errors.some((error: string) => error.includes("before all canonical requirements")));
});

