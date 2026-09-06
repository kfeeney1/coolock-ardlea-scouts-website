import assert from "node:assert/strict";
import test from "node:test";

import {
  adventureSkillsById,
  requirementsForSharedCompetency
} from "../../src/data/adventureSkills/index.ts";

function requirement(skillId: string, stage: number, index: number) {
  const skill = adventureSkillsById.get(skillId);
  assert.ok(skill, `missing skill ${skillId}`);
  const found = skill.stages[stage - 1]?.requirements[index - 1];
  assert.ok(found, `missing ${skillId} stage ${stage} requirement ${index}`);
  return found;
}

test("Buddy System completion is shared across equivalent handbook competencies", () => {
  const ids = requirementsForSharedCompetency("buddy-system").map(({ id }) => id);
  for (const expected of [
    "camping-stage-1-requirement-06",
    "emergencies-stage-1-requirement-04",
    "hillwalking-stage-1-requirement-09",
    "paddling-stage-1-requirement-06",
    "rowing-stage-1-requirement-02",
    "sailing-stage-1-requirement-02"
  ]) {
    assert.ok(ids.includes(expected), `${expected} should share Buddy System completion`);
  }
  assert.equal(requirement("swimming", 1, 5).sharedCompetencyKey, undefined,
    "Swimming combines Buddy System knowledge with pool safety and must remain independent");
});

test("only like-for-like emergency-service outcomes are grouped", () => {
  assert.equal(requirementsForSharedCompetency("emergency-services-full").length, 4);
  assert.equal(requirementsForSharedCompetency("contact-emergency-services").length, 3);
});

test("equivalent introductory safety competencies share completion", () => {
  assert.equal(requirementsForSharedCompetency("follow-instructor-directions").length, 7);
  assert.equal(requirementsForSharedCompetency("leave-no-trace-main-principles").length, 7);
  assert.equal(requirementsForSharedCompetency("hypothermia-awareness").length, 3);
  assert.equal(requirementsForSharedCompetency("cpr-and-recovery-position").length, 3);
  assert.equal(requirementsForSharedCompetency("water-activity-safety-precautions").length, 3);
});

test("canonical wording fixes obvious transcription and grammar errors", () => {
  assert.equal(requirement("emergencies", 1, 4).statement, "I know how to use the “Buddy” system.");
  assert.equal(requirement("emergencies", 6, 6).statement, "I know how to look for, monitor and record vital signs.");
  assert.equal(requirement("hillwalking", 2, 6).statement, "I can be a responsible member of my team while we are hiking.");
  assert.equal(requirement("paddling", 8, 10).statement, "I can manoeuvre an empty kayak between two specified points.");
  assert.equal(requirement("air-activities", 1, 3).statement, "I can build a paper aeroplane from an A4 sheet that will fly, climb and turn.");
});

test("canonicalisation preserves stable requirement IDs", () => {
  assert.equal(requirement("camping", 1, 9).id, "camping-stage-1-requirement-09");
  assert.equal(requirement("emergencies", 8, 5).id, "emergencies-stage-8-requirement-05");
  assert.equal(requirement("air-activities", 9, 6).id, "air-activities-stage-9-requirement-06");
});
