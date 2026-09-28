import assert from "node:assert/strict";
import test from "node:test";
import { effectiveOperationalSections } from "../../src/services/leaderAccessLogic.ts";

const appointment = (appointment: any, scope: string) => ({ id: appointment.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"--"+scope.toLowerCase(), appointment, scope, active: true });

test("single-section leaders retain only their effective section", () => {
  assert.deepEqual(effectiveOperationalSections("leader", ["Cubs"], [appointment("Programme Scouter","Cubs")]), ["Cubs"]);
});

test("multi-section leaders receive the union of current account and appointment sections", () => {
  assert.deepEqual(effectiveOperationalSections("leader", ["Cubs","Scouts"], [appointment("Programme Scouter","Cubs"),appointment("Scouter","Scouts")]), ["Cubs","Scouts"]);
});

test("group leadership receives all youth operational sections", () => {
  assert.deepEqual(effectiveOperationalSections("leader", ["Group"], [appointment("Group Leader","Group")]), ["Beavers","Cubs","Scouts","Ventures","Rovers"]);
});

test("group-only non-leadership appointments do not silently grant all section meeting scope", () => {
  assert.deepEqual(effectiveOperationalSections("leader", ["Group"], [appointment("Group Treasurer","Group")]), []);
});


test("inactive appointment sections are excluded from operational scope", () => {
  assert.deepEqual(effectiveOperationalSections("leader", ["Group"], [{ ...appointment("Programme Scouter","Cubs"), active: false }]), []);
});

test("section appointment scope grants only that operational section", () => {
  assert.deepEqual(effectiveOperationalSections("leader", ["Group"], [appointment("Programme Scouter","Cubs")]), ["Cubs"]);
});
