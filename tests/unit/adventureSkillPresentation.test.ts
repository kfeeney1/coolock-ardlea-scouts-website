import assert from "node:assert/strict";
import test from "node:test";

import { adventureSkillColour, highestAwardedLevelLabel } from "../../src/services/adventureSkillPresentation.ts";

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

test("badge tiles show the highest awarded level and not competency progress", () => {
  assert.equal(highestAwardedLevelLabel(0), "Not started");
  assert.equal(highestAwardedLevelLabel(1), "Level 1");
  assert.equal(highestAwardedLevelLabel(6), "Level 6");
  assert.equal(highestAwardedLevelLabel(9), "Level 9");
});
