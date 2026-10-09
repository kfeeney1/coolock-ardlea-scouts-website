import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatFocusedOutputs, selectFocusedGroups } from "../../scripts/focused-playwright-selection.mjs";
import { suiteSpecs } from "../../scripts/playwright-suites.mjs";

const workflow = readFileSync(".github/workflows/playwright-e2e.yml", "utf8");

test("unrelated docs and non-focused suites avoid the focused emulator job", () => {
  assert.deepEqual(
    [...selectFocusedGroups(["docs/operations.md", "src/pages/FinanceCashbook.tsx", "email-worker/src/productionRoutes.js"])],
    []
  );
  assert.deepEqual([...selectFocusedGroups(["e2e/adventure-skills-badgework.spec.ts"])], []);
});

test("activity changes retain all focused meeting regressions and navigation checks", () => {
  assert.deepEqual(
    [...selectFocusedGroups(["src/services/weeklyTracker.ts"])],
    ["activities", "navigation"]
  );
  assert.deepEqual(
    [...selectFocusedGroups(["e2e/event-record-page.spec.ts"])],
    ["activities", "navigation"]
  );
  assert.deepEqual(
    [...selectFocusedGroups(["e2e/sw362-event-edit-navigation.spec.ts", "src/hooks/useConfirmEventLeave.ts"])],
    ["activities", "navigation"]
  );
  assert.deepEqual(
    [...selectFocusedGroups(["tests/unit/focusedPlaywrightSelection.test.ts"])],
    ["activities", "navigation"]
  );
});

test("poll and communications changes select their own focused assertions", () => {
  assert.deepEqual([...selectFocusedGroups(["e2e/polls.spec.ts"])], ["polls"]);
  assert.deepEqual(
    [...selectFocusedGroups(["e2e/leader-communications.spec.ts"])],
    ["communications"]
  );
});

test("unknown shared paths and Playwright workflow edits conservatively run all focused groups", () => {
  const all = ["navigation", "activities", "polls", "communications"];
  assert.deepEqual([...selectFocusedGroups(["src/components/UnknownSharedControl.tsx"])], all);
  assert.deepEqual([...selectFocusedGroups([".github/workflows/playwright-e2e.yml"])], all);
  assert.equal(formatFocusedOutputs(new Set()).startsWith("run=false\n"), true);
});

test("focused workflow groups retain no-retry regressions while shards retain suite coverage", () => {
  assert.match(workflow, /focused_pr:[\s\S]*?needs: focused_selection[\s\S]*?needs\.focused_selection\.outputs\.run == 'true'/);
  assert.match(workflow, /name: Run focused SW-170 tests\n\s+if: \$\{\{ needs\.focused_selection\.outputs\.activities == 'true' \}\}[\s\S]*?event-record-page\.spec\.ts e2e\/weekly-record-integrity\.spec\.ts[^\n]*--retries=0/);
  assert.match(workflow, /name: Run focused blocking regressions\n\s+if: \$\{\{ needs\.focused_selection\.outputs\.activities == 'true' \}\}[\s\S]*?programme-library\.spec\.ts e2e\/weekly-section-tracker\.spec\.ts[^\n]*--retries=0/);
  assert.match(workflow, /name: Run SW-317 communications suite after authenticated journeys\n\s+if: \$\{\{ needs\.focused_selection\.outputs\.communications == 'true' \}\}[\s\S]*?leader-communications\.spec\.ts[^\n]*--retries=0/);
  assert.match(workflow, /name: Run focused SW-357 poll lifecycle\n\s+if: \$\{\{ needs\.focused_selection\.outputs\.polls == 'true' \}\}[\s\S]*?polls\.spec\.ts[^\n]*--retries=0/);
  assert.ok(suiteSpecs["activities-programme"].includes("event-record-page.spec.ts"));
  assert.ok(suiteSpecs["activities-programme"].includes("sw362-event-edit-navigation.spec.ts"));
  assert.ok(suiteSpecs["activities-programme"].includes("weekly-record-integrity.spec.ts"));
  assert.ok(suiteSpecs["activities-programme"].includes("programme-library.spec.ts"));
  assert.ok(suiteSpecs["activities-programme"].includes("weekly-section-tracker.spec.ts"));
});

test("communications, role, device and keyboard navigation assertions remain registered", () => {
  assert.ok(suiteSpecs["public-pages"].includes("leader-communications.spec.ts"));
  assert.ok(suiteSpecs["smoke-navigation"].includes("leader-journey.spec.ts"));
  assert.ok(suiteSpecs["smoke-navigation"].includes("leader-navigation.spec.ts"));
  const communications = readFileSync("e2e/leader-communications.spec.ts", "utf8");
  const navigation = readFileSync("e2e/leader-navigation.spec.ts", "utf8");
  assert.match(communications, /ordinary leader composes first, then chooses recipients/);
  assert.match(communications, /leader dashboard navigation uses an expandable desktop menu/);
  assert.match(communications, /leader dashboard navigation uses the same expandable menu on Pixel 7/);
  assert.match(navigation, /Leader Menu supports keyboard open and Escape focus restoration/);
});
