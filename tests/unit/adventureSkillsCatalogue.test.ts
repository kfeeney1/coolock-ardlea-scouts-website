import assert from "node:assert/strict";
import test from "node:test";

import {
    adventureSkills,
    adventureSkillsById,
    allAdventureSkillRequirements,
    requirementsForSharedCompetency
} from "../../src/data/adventureSkills/index.ts";

test("catalogue contains the nine handbook skills plus Swimming", () => {
    assert.equal(adventureSkills.length, 10);
    assert.deepEqual(
        adventureSkills.map((skill) => skill.id),
        ["camping", "backwoods", "pioneering", "emergencies", "hillwalking", "air-activities", "paddling", "rowing", "sailing", "swimming"]
    );
});

test("handbook skills have nine stages and Swimming has six", () => {
    for (const skill of adventureSkills) {
        const expectedStages = skill.id === "swimming" ? 6 : 9;
        assert.equal(skill.maxStage, expectedStages, `${skill.id} maxStage`);
        assert.equal(skill.stages.length, expectedStages, `${skill.id} stage count`);
        assert.deepEqual(skill.stages.map((stage) => stage.stage), Array.from({ length: expectedStages }, (_, index) => index + 1));
        assert.ok(skill.stages.every((stage) => stage.requirements.length > 0), `${skill.id} has an empty stage`);
    }
});

test("requirements have stable unique IDs and non-empty source statements", () => {
    const requirements = allAdventureSkillRequirements();
    const ids = requirements.map((requirement) => requirement.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const requirement of requirements) {
        assert.match(requirement.id, /^[a-z0-9-]+-stage-[1-9]-requirement-\d{2}$/);
        assert.ok(requirement.statement.trim().length > 0, `${requirement.id} has an empty statement`);
    }
});

test("catalogue lookup resolves every skill ID", () => {
    for (const skill of adventureSkills) assert.equal(adventureSkillsById.get(skill.id), skill);
});

test("explicit Buddy System equivalence links the matching handbook competencies", () => {
    const buddyRequirements = requirementsForSharedCompetency("buddy-system");
    assert.deepEqual(
        buddyRequirements.map((requirement) => requirement.id).sort(),
        [
            "camping-stage-1-requirement-06",
            "hillwalking-stage-1-requirement-09",
            "paddling-stage-1-requirement-06",
            "rowing-stage-1-requirement-02",
            "sailing-stage-1-requirement-02"
        ]
    );

    for (const requirement of buddyRequirements) {
        assert.match(requirement.statement, /buddy[^a-z0-9]*system/i, requirement.id);
    }
});

test("Swimming uses the March 2026 source and stops at Stage 6", () => {
    const swimming = adventureSkillsById.get("swimming");
    assert.ok(swimming);
    assert.equal(swimming.source, "swimming-adventure-skill-2026-03");
    assert.equal(swimming.maxStage, 6);
    assert.equal(swimming.stages.at(-1)?.stage, 6);
});
