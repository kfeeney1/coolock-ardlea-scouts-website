import test from "node:test";
import assert from "node:assert/strict";
import { hallHireEnabled } from "../../src/services/hallHireRolloutPolicy.ts";
test("Hall Hire is independently off unless both rollout and readiness are explicitly true", () => {
  for (const setting of [undefined, null, {}, {enabled: false}, {enabled: "true"}, {enabled: 1}, {version: "redesigned"}]) assert.equal(hallHireEnabled(setting, {ready: true}), false);
  for (const readiness of [undefined, null, {}, {ready: false}, {ready: "true"}, {ready: 1}]) assert.equal(hallHireEnabled({enabled: true}, readiness), false);
  assert.equal(hallHireEnabled({enabled: true}, {ready: true}), true);
  assert.equal(hallHireEnabled({enabled: false, calendarExperience: "redesigned"}, {ready: true}), false);
});
