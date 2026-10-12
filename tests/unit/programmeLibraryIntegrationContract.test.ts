import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("weekly meetings renders the programme library with fresh insert callbacks", async () => {
  const page = await readFile("src/pages/WeeklySectionTracker.tsx", "utf8");
  const planner = await readFile("src/components/admin/WeeklyProgrammePlanner.tsx", "utf8");
  assert.match(page, /<WeeklyProgrammePlanner/);
  assert.match(planner, /<ProgrammeLibraryPanel section=\{selected\.section\}/);
  assert.match(planner, /onInsertActivity=\{\(item\)=>patch\(\{activities:\[\.\.\.selected\.activities,item\]\}\)\}/);
  assert.match(planner, /onInsertBadgework=\{\(item\)=>patch\(\{badgeworkPlan:\[\.\.\.selected\.badgeworkPlan,item\]\}\)\}/);
});

test("programme library persistence remains separate from meeting state", async () => {
  const source = await readFile("src/services/programmeLibrary.ts", "utf8");
  assert.doesNotMatch(source, /attendance|injuries|completedBadgework|postMeeting/i);
  assert.match(source, /programmeLibrary/);
});
