import assert from "node:assert/strict";
import test from "node:test";
import { badgeworkVersion } from "../../src/services/badgeworkExperienceLogic.ts";

test("badgework redesign defaults off for absent, malformed or unknown settings", () => {
  for (const data of [undefined, {}, { version: null }, { version: true }, { version: "future" }, { version: "existing" }]) {
    assert.equal(badgeworkVersion(data), "existing");
  }
});
test("badgework choice is independent of other experience versions", () => {
  assert.equal(badgeworkVersion({ version: "redesigned" }), "redesigned");
  assert.equal(badgeworkVersion({ meetingExperience: "redesigned", scheduleExperience: "redesigned" }), "existing");
});
