import test from "node:test";
import assert from "node:assert/strict";

import { nextSectionMeetingDate } from "../../src/services/weeklyMeetingDate.mjs";
import { newWeeklyEntry, reconcileOpenWeeklyRoster, sortOpenWeeklyMeetings } from "../../src/services/weeklyTrackerLogic.ts";

function meeting(id: string, meetingDate: string, section = "Scouts") {
  return { id, meetingDate, section, status: "open" as const, location: "", theme: "", activities: [], badgeworkPlan: [], programmeNotes: "", notes: "", entries: [], injuries: [] };
}

test("SW-323 open meetings sort by canonical date with deterministic legacy fallback", () => {
  const sorted = sortOpenWeeklyMeetings([meeting("late","2027-01-02"), meeting("bad","unknown"), meeting("early","2026-12-31"), meeting("tie-b","2027-01-02","Ventures"), meeting("tie-a","2027-01-02","Cubs")]);
  assert.deepEqual(sorted.map((item) => item.id), ["early","tie-a","late","tie-b","bad"]);
});

test("SW-324 multi-section roster includes eligible members once and preserves existing attendance", () => {
  const existing = [{ ...newWeeklyEntry("dual","Dual Member"), attendance: "present" as const, uniform: true }];
  const members = [
    { id:"single", displayName:"Single Cub", section:"Cubs", sections:["Cubs"], status:"active" },
    { id:"dual", displayName:"Dual Member", section:"Cubs", sections:["Cubs","Scouts"], status:"active" },
    { id:"inactive", displayName:"Inactive", section:"Scouts", sections:["Scouts"], status:"inactive" }
  ];
  const scouts = reconcileOpenWeeklyRoster(existing, members, "Scouts");
  assert.equal(scouts.filter((entry) => entry.memberId === "dual").length, 1);
  assert.equal(scouts.find((entry) => entry.memberId === "dual")?.attendance, "present");
  assert.equal(scouts.find((entry) => entry.memberId === "dual")?.uniform, true);
  assert.equal(scouts.some((entry) => entry.memberId === "inactive"), false);
  assert.equal(reconcileOpenWeeklyRoster([], members, "Cubs").filter((entry) => entry.memberId === "dual").length, 1);
});

test("SW-325 legacy/new attendance entries default uniform independently", () => {
  assert.equal(newWeeklyEntry("one","One").uniform, false);
  assert.equal(newWeeklyEntry("two","Two").uniform, false);
});

test("SW-328 section meeting defaults use the next future Tuesday/Wednesday across boundaries", () => {
  const monday = new Date(2026, 11, 28, 12, 0, 0);
  assert.equal(nextSectionMeetingDate("Cubs", monday), "2026-12-29");
  assert.equal(nextSectionMeetingDate("Ventures", monday), "2026-12-29");
  assert.equal(nextSectionMeetingDate("Beavers", monday), "2026-12-30");
  assert.equal(nextSectionMeetingDate("Scouts", monday), "2026-12-30");
  assert.equal(nextSectionMeetingDate("Cubs", new Date(2026, 11, 29, 12, 0, 0)), "2027-01-05");
  assert.equal(nextSectionMeetingDate("Scouts", new Date(2026, 11, 30, 12, 0, 0)), "2027-01-06");
});
