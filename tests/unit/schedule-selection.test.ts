import { test } from "node:test";
import assert from "node:assert/strict";
import { initialScheduleId, orderedSchedule, scheduleIdForDate, scheduleToday } from "../../src/services/scheduleSelection.ts";
const records = [{ id: "future", date: "2026-10-20" }, { id: "past", date: "2026-10-10" }, { id: "today", date: "2026-10-18" }];
test("schedule chooses today, next, historical fallback and empty deterministically", () => {
  assert.equal(initialScheduleId(records, "2026-10-18"), "today");
  assert.equal(initialScheduleId(records, "2026-10-19"), "future");
  assert.equal(initialScheduleId(records, "2026-10-30"), "future");
  assert.equal(initialScheduleId([], "2026-10-18"), "");
  assert.equal(initialScheduleId([{ id: "camp", date: "2026-10-17", endDate: "2026-10-19" }, ...records], "2026-10-18"), "camp");
});
test("date selection shares selection rule, supports duplicate dates and does not mutate records", () => {
  assert.equal(scheduleIdForDate(records, "2026-10-11"), "today");
  assert.deepEqual(orderedSchedule(records).map(x => x.id), ["past", "today", "future"]);
  assert.equal(records[0].id, "future");
  assert.equal(initialScheduleId([{ id: "b", date: "2026-10-18" }, { id: "a", date: "2026-10-18" }], "2026-10-18"), "a");
});

test("schedule uses Ireland calendar date near summer midnight", () => {
  assert.equal(scheduleToday(new Date("2026-06-01T23:30:00Z")), "2026-06-02");
});
