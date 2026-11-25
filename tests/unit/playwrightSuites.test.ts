import assert from "node:assert/strict";
import test from "node:test";
import { suiteSpecs, suitesForChangedPath } from "../../scripts/playwright-suites.mjs";

test("changed application paths select the matching Playwright suites", () => {
  assert.deepEqual(suitesForChangedPath("src/services/weeklyTracker.ts"), ["activities-programme"]);
  assert.deepEqual(suitesForChangedPath("src/services/leaderProfile.ts"), ["members-parents-consent"]);
  assert.deepEqual(suitesForChangedPath("e2e/event-record-page.spec.ts"), ["activities-programme"]);
  assert.deepEqual(suitesForChangedPath("e2e/sw265-badgework-navigation.spec.ts"), ["badgework"]);
});

for (const path of [".github/workflows/playwright-e2e.yml", "scripts/playwright-suites.mjs"]) {
  test(`${path} independently selects every Playwright suite`, () => {
    assert.deepEqual(suitesForChangedPath(path), Object.keys(suiteSpecs));
  });
}

test("unknown shared application paths conservatively request the full suite", () => {
  assert.equal(suitesForChangedPath("src/components/UnknownSharedControl.tsx"), null);
});

test("operational workflows and focused-selection retirement artifacts do not select browser suites", () => {
  for (const path of [
    ".github/workflows/firestore-backup-freshness.yml",
    ".github/workflows/firestore-backup.yml",
    ".github/workflows/sw-318-first-run.yml",
    "scripts/focused-playwright-selection.mjs",
    "tests/unit/focusedPlaywrightSelection.test.ts",
    "tests/unit/playwrightSuites.test.ts"
  ]) {
    assert.deepEqual(suitesForChangedPath(path), [], path);
  }
});
