import assert from "node:assert/strict";
import test from "node:test";

import {
  completionTargetsForRequirement,
  completionTargetsForStage,
  isStageComplete,
  requirementIdsForStage,
  stageAwardId
} from "../../src/services/adventureSkillProgressLogic.ts";

test("shared Buddy System completion propagates to every explicitly equivalent requirement", () => {
  const targets = completionTargetsForRequirement("camping-stage-1-requirement-06");
  assert.deepEqual(
    targets.map((target) => target.requirementId).sort(),
    [
      "camping-stage-1-requirement-06",
      "hillwalking-stage-1-requirement-09",
      "paddling-stage-1-requirement-06",
      "rowing-stage-1-requirement-02",
      "sailing-stage-1-requirement-02"
    ]
  );
  assert.ok(targets.every((target) => target.sharedCompetencyKey === "buddy-system"));
});

test("ordinary requirements only complete themselves", () => {
  const targets = completionTargetsForRequirement("camping-stage-1-requirement-01");
  assert.deepEqual(targets.map((target) => target.requirementId), ["camping-stage-1-requirement-01"]);
});

test("stage completion uses all headline requirements and accepts shared equivalents", () => {
  const campingStageOne = requirementIdsForStage("camping", 1);
  const completed = new Set(campingStageOne.filter((id) => id !== "camping-stage-1-requirement-06"));
  completed.add("rowing-stage-1-requirement-02");
  assert.equal(isStageComplete(completed, "camping", 1), true);

  completed.delete("camping-stage-1-requirement-01");
  assert.equal(isStageComplete(completed, "camping", 1), false);
});

test("bulk stage targets include propagated shared requirements without duplicates", () => {
  const targets = completionTargetsForStage("camping", 1);
  const ids = targets.map((target) => target.requirementId);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes("camping-stage-1-requirement-06"));
  assert.ok(ids.includes("rowing-stage-1-requirement-02"));
});

test("stage awards use a stable ID but remain separate from requirement completion", () => {
  assert.equal(stageAwardId("camping", 1), "camping-stage-1");
  assert.equal(stageAwardId("swimming", 6), "swimming-stage-6");
  assert.throws(() => stageAwardId("swimming", 7), /Unknown Adventure Skills award/);
});

test("unknown catalogue references fail closed", () => {
  assert.throws(() => completionTargetsForRequirement("missing"), /Unknown Adventure Skills requirement/);
  assert.throws(() => requirementIdsForStage("camping", 10), /Unknown Camping stage/);
});
