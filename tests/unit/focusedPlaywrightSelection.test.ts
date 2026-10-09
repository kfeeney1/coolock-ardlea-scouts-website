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

});

test("backup workflows and focused selector-only changes do not start browser jobs", () => {
  for (const path of [
    ".github/workflows/firestore-backup-freshness.yml",
    ".github/workflows/firestore-backup.yml",
    "scripts/focused-playwright-selection.mjs",
    "tests/unit/focusedPlaywrightSelection.test.ts"
  ]) {
    assert.deepEqual([...selectFocusedGroups([path])], [], path);
    assert.equal(formatFocusedOutputs(selectFocusedGroups([path])).split("\n")[0], "run=false");
  }
  assert.deepEqual([...selectFocusedGroups([
    "scripts/focused-playwright-selection.mjs",
    "tests/unit/focusedPlaywrightSelection.test.ts",
    ".github/workflows/firestore-backup-freshness.yml"
  ])], []);
  assert.deepEqual([...selectFocusedGroups([
    "scripts/focused-playwright-selection.mjs", "src/services/weeklyTracker.ts"
  ])], ["activities", "navigation"]);
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

test("focused assurance verifies selection policy without legacy browser journeys", () => {
  assert.match(workflow, /name: Focused PR assurance/);
  assert.match(workflow, /name: Verify focused selection policy/);
  assert.match(workflow, /node --experimental-strip-types --test tests\\/unit\\/focusedPlaywrightSelection\\.test\\.ts/);
  assert.doesNotMatch(workflow, /  focused_pr:/);
  assert.doesNotMatch(workflow, /Run focused SW-320|Run focused SW-362|Run focused SW-170/);
  assert.match(workflow, /  e2e_shard:/);
  assert.match(workflow, /npm run test:e2e:pr/);
  assert.ok(suiteSpecs["activities-programme"].includes("event-record-page.spec.ts"));
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
