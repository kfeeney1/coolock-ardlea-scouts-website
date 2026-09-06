import assert from "node:assert/strict";
import test from "node:test";

import { adventureSkillColour, badgeworkSkillLevelLabel, highestAwardedLevelLabel } from "../../src/services/adventureSkillPresentation.ts";

test("Adventure Skill colours follow the supplied badge palette", () => {
  assert.equal(adventureSkillColour("camping"), "#5B9D3B");
  assert.equal(adventureSkillColour("backwoods"), "#FF7A1A");
  assert.equal(adventureSkillColour("pioneering"), "#005C5F");
  assert.equal(adventureSkillColour("emergencies"), "#FF7A45");
  assert.equal(adventureSkillColour("hillwalking"), "#00A36C");
  assert.equal(adventureSkillColour("air-activities"), "#0D8DC9");
  assert.equal(adventureSkillColour("paddling"), "#226EB5");
  assert.equal(adventureSkillColour("rowing"), "#06346F");
  assert.equal(adventureSkillColour("sailing"), "#0B6FB8");
  assert.equal(adventureSkillColour("swimming"), "#08A9C5");
});

test("unknown Adventure Skills use a neutral fallback colour", () => {
  assert.equal(adventureSkillColour("future-skill"), "#6B7280");
});

test("badge tiles show the highest awarded level when no level is currently started", () => {
  assert.equal(highestAwardedLevelLabel(0), "Not started");
  assert.equal(highestAwardedLevelLabel(1), "Level 1");
  assert.equal(highestAwardedLevelLabel(6), "Level 6");
  assert.equal(highestAwardedLevelLabel(9), "Level 9");
});

test("badge tiles show the earliest incomplete level that has progress", () => {
  assert.equal(badgeworkSkillLevelLabel(0, [
    { stage: 1, status: "in-progress" },
    { stage: 2, status: "not-started" }
  ]), "Level 1 started");

  assert.equal(badgeworkSkillLevelLabel(0, [
    { stage: 1, status: "in-progress" },
    { stage: 2, status: "in-progress" }
  ]), "Level 1 started");

  assert.equal(badgeworkSkillLevelLabel(0, [
    { stage: 1, status: "requirements-complete" },
    { stage: 2, status: "in-progress" }
  ]), "Level 2 started");

  assert.equal(badgeworkSkillLevelLabel(1, [
    { stage: 1, status: "awarded" },
    { stage: 2, status: "in-progress" },
    { stage: 3, status: "in-progress" }
  ]), "Level 2 started");
});

test("badge tiles show the earliest level awaiting award when no level is partially complete", () => {
  assert.equal(badgeworkSkillLevelLabel(0, [
    { stage: 1, status: "requirements-complete" },
    { stage: 2, status: "not-started" }
  ]), "Level 1 awaiting award");

  assert.equal(badgeworkSkillLevelLabel(1, [
    { stage: 1, status: "awarded" },
    { stage: 2, status: "requirements-complete" },
    { stage: 3, status: "not-started" }
  ]), "Level 2 awaiting award");

  assert.equal(badgeworkSkillLevelLabel(0, [
    { stage: 1, status: "requirements-complete" },
    { stage: 2, status: "requirements-complete" }
  ]), "Level 1 awaiting award");
});

test("badge tiles keep a started level ahead of a lower level awaiting award", () => {
  assert.equal(badgeworkSkillLevelLabel(0, [
    { stage: 1, status: "requirements-complete" },
    { stage: 2, status: "in-progress" }
  ]), "Level 2 started");
});

test("badge tiles fall back to highest awarded level when no level is started or awaiting award", () => {
  assert.equal(badgeworkSkillLevelLabel(2, [
    { stage: 1, status: "awarded" },
    { stage: 2, status: "awarded" },
    { stage: 3, status: "not-started" }
  ]), "Level 2");

  assert.equal(badgeworkSkillLevelLabel(0, [
    { stage: 1, status: "not-started" }
  ]), "Not started");
});
