import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCatalogueIndex,
  canManageAdventureAwards,
  canonicalAward,
  isCanonicalProgressDocument,
  isStageAuthoritativelyComplete,
  normaliseAwardRequest,
} from "../lib/adventure-award-policy.mjs";

const catalogue = [
  {
    id: "camping",
    maxStage: 2,
    stages: [
      { stage: 1, requirements: [
        { id: "camping-stage-1-requirement-01" },
        { id: "camping-stage-1-requirement-02", sharedCompetencyKey: "shared-safe" },
      ] },
      { stage: 2, requirements: [{ id: "camping-stage-2-requirement-01" }] },
    ],
  },
  {
    id: "emergencies",
    maxStage: 1,
    stages: [{ stage: 1, requirements: [{ id: "emergencies-stage-1-requirement-01", sharedCompetencyKey: "shared-safe" }] }],
  },
  {
    id: "swimming",
    maxStage: 6,
    stages: Array.from({ length: 6 }, (_, index) => ({
      stage: index + 1,
      requirements: [{ id: `swimming-stage-${index + 1}-requirement-01` }],
    })),
  },
];

const index = buildCatalogueIndex(catalogue);
const progress = (id, memberId = "member-1", overrides = {}) => {
  const canonical = index.requirements.get(id);
  return {
    id,
    data: {
      memberId,
      requirementId: id,
      skillId: canonical?.skillId,
      stage: canonical?.stage,
      sharedCompetencyKey: canonical?.sharedCompetencyKey ?? "",
      completedAt: new Date(),
      completedBy: "leader-1",
      ...overrides,
    },
  };
};

test("canonical awards reject invalid skills and Swimming stage 7+", () => {
  assert.equal(canonicalAward(index, "camping", 1)?.awardId, "camping-stage-1");
  assert.equal(canonicalAward(index, "unknown", 1), null);
  assert.equal(canonicalAward(index, "swimming", 7), null);
});

test("stage readiness requires every canonical requirement", () => {
  assert.equal(isStageAuthoritativelyComplete(index, "member-1", [progress("camping-stage-1-requirement-01")], "camping", 1), false);
  assert.equal(isStageAuthoritativelyComplete(index, "member-1", [
    progress("camping-stage-1-requirement-01"),
    progress("camping-stage-1-requirement-02"),
  ], "camping", 1), true);
});

test("shared competency progress satisfies the canonical equivalent requirement", () => {
  assert.equal(isStageAuthoritativelyComplete(index, "member-1", [
    progress("camping-stage-1-requirement-01"),
    progress("emergencies-stage-1-requirement-01"),
  ], "camping", 1), true);
});

test("tampered progress identity is ignored", () => {
  const forged = progress("camping-stage-1-requirement-01", "member-1", { skillId: "emergencies" });
  assert.equal(isCanonicalProgressDocument(index, "member-1", forged.id, forged.data), false);
  assert.equal(isStageAuthoritativelyComplete(index, "member-1", [
    forged,
    progress("camping-stage-1-requirement-02"),
  ], "camping", 1), false);
});

test("progress from another child cannot satisfy readiness", () => {
  assert.equal(isStageAuthoritativelyComplete(index, "member-1", [
    progress("camping-stage-1-requirement-01", "member-2"),
    progress("camping-stage-1-requirement-02", "member-2"),
  ], "camping", 1), false);
});

test("RBAC preserves section scope, admin access, group-leader access and inactive denial", () => {
  const member = { section: "Beavers", status: "active" };
  assert.equal(canManageAdventureAwards({ active: true, role: "leader", sections: ["Beavers"] }, null, member), true);
  assert.equal(canManageAdventureAwards({ active: true, role: "leader", sections: ["Cubs"] }, null, member), false);
  assert.equal(canManageAdventureAwards({ active: true, role: "admin", sections: ["Cubs"] }, null, member), true);
  assert.equal(canManageAdventureAwards({ active: true, role: "leader", sections: ["Cubs"] }, { active: true, scoutingRole: "Group Leader" }, member), true);
  assert.equal(canManageAdventureAwards({ active: false, role: "admin", sections: ["Beavers"] }, null, member), false);
});

test("bulk request normalisation de-duplicates members and rejects oversized/invalid requests", () => {
  assert.deepEqual(normaliseAwardRequest({ memberIds: ["a", "a", " b "], skillId: "camping", stage: 1, awarded: true }), {
    memberIds: ["a", "b"], skillId: "camping", stage: 1, awarded: true,
  });
  assert.throws(() => normaliseAwardRequest({ memberIds: [], skillId: "camping", stage: 1, awarded: true }));
  assert.throws(() => normaliseAwardRequest({ memberIds: ["a"], skillId: "camping", stage: 1, awarded: "yes" }));
});
