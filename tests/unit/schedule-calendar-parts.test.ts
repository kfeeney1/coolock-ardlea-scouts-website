import assert from "node:assert/strict";
import test from "node:test";
import { scheduleCalendarParts } from "../../src/services/scheduleCalendarParts.ts";
import { formatSiteDate, installSitewideDateFormat } from "../../src/services/siteDateFormat.ts";

test("calendar captions remain textual with the site's numeric date policy installed", () => {
  installSitewideDateFormat();
  assert.deepEqual(scheduleCalendarParts("2026-10-19"), { weekday: "Mon", day: "19", month: "Oct" });
  assert.equal(formatSiteDate("2026-10-19"), "19-10-2026");
  assert.equal(new Date("2026-10-19T12:00:00Z").toLocaleDateString("en-IE", { weekday: "short" }), "19-10-2026");
});
test("calendar captions preserve date-only identity across year and leap-day boundaries", () => {
  assert.deepEqual(scheduleCalendarParts("2027-01-01"), { weekday: "Fri", day: "01", month: "Jan" });
  assert.deepEqual(scheduleCalendarParts("2028-02-29"), { weekday: "Tue", day: "29", month: "Feb" });
});
