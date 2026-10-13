import assert from "node:assert/strict";
import test from "node:test";
import { leaderAttendanceHasChanges } from "../../src/services/leaderAttendanceChanges.ts";
import type { LeaderAttendanceEntry } from "../../src/services/leaderAttendance";

const roster: LeaderAttendanceEntry[] = Array.from({ length: 90 }, (_, index) => ({
  leaderUid: `leader-${index}`, displayName: `Leader ${index}`, appointments: ["Programme Scouter"],
  sections: ["Scouts"], attendance: "unrecorded"
}));

test("unchanged loaded attendance needs no writes when saving meeting notes or programme", () => {
  assert.equal(leaderAttendanceHasChanges(structuredClone(roster), roster), false);
});

test("attendance edits and removals still require confirmed persistence", () => {
  const edited = structuredClone(roster);
  edited[0].attendance = "present";
  assert.equal(leaderAttendanceHasChanges(edited, roster), true);
  assert.equal(leaderAttendanceHasChanges(roster.slice(1), roster), true);
});

test("a failed attendance save keeps changes dirty until its saved snapshot advances", () => {
  const edited = structuredClone(roster);
  edited[0].attendance = "absent";
  assert.equal(leaderAttendanceHasChanges(edited, roster), true);
  assert.equal(leaderAttendanceHasChanges(edited, structuredClone(edited)), false);
});
