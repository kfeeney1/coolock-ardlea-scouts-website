import assert from "node:assert/strict";
import test from "node:test";
import { calendarDays, calendarEntriesForDay, calendarMonth, calendarMonthCaption, shiftCalendarMonth, type CalendarEntry } from "../../src/services/groupCalendar.ts";
import { installSitewideDateFormat } from "../../src/services/siteDateFormat.ts";
test("monthly rows span Monday to Sunday across leap and year boundaries", () => {
  assert.equal(calendarDays("2026-10")[0], "2026-09-28");
  assert.equal(calendarDays("2026-10").at(-1), "2026-11-01");
  assert.equal(calendarDays("2028-02").includes("2028-02-29"), true);
  assert.equal(calendarDays("2026-03").length, 42);
  assert.equal(shiftCalendarMonth("2026-12", 1), "2027-01");
  assert.equal(shiftCalendarMonth("2027-01", -1), "2026-12");
  for (const value of [null, "2026-00", "2026-13", "oops", "0001-01"]) assert.equal(calendarMonth(value, "2026-10-22"), "2026-10");
  assert.equal(calendarMonth("2028-02", "2026-10-22"), "2028-02");
});
test("all same-day sources remain visible in all-day then chronological order with whole-month filters", () => {
  const base = {date: "2026-10-22", title: "Record", section: "Scouts", path: "/source"};
  const entries: CalendarEntry[] = [
    {...base, id: "late", type: "event", time: "20:00"},
    {...base, id: "early", type: "maintenance", time: "16:30", section: "Group"},
    {...base, id: "meeting", type: "meeting", time: "18:30"},
    {...base, id: "all-day", type: "event", date: "2026-10-21", endDate: "2026-10-24", time: ""},
    {...base, id: "other", type: "event", date: "2026-10-24", time: "10:00"}
  ];
  assert.deepEqual(calendarEntriesForDay(entries, base.date, "all", "").map(e => e.id), ["all-day", "early", "meeting", "late"]);
  assert.deepEqual(calendarEntriesForDay(entries, "2026-10-24", "event", "Scouts").map(e => e.id), ["all-day", "other"]);
  assert.deepEqual(calendarEntriesForDay(entries, base.date, "maintenance", "Scouts"), []);
  assert.deepEqual(calendarEntriesForDay(entries, "2026-10-25", "all", ""), []);
});
test("month captions remain textual under the numeric date override", () => {
  installSitewideDateFormat();
  assert.equal(calendarMonthCaption("2026-10"), "October 2026");
});
