import assert from "node:assert/strict";
import test from "node:test";
import { calendarReturnPath, calendarSourceEntry } from "../../src/services/calendarSourceLogic.ts";
test("canonical meeting date and encoded programme supply the entry without private attendance or notes", () => {
  const entry = calendarSourceEntry("weeklyMeetings", "source", {section: "Scouts", meetingDate: "2026-10-22", status: "closed", programmeNotes: JSON.stringify({marker: "weekly-programme-v1", theme: "Pioneering", notes: "Private programme notes"}), entries: [{memberName: "Private participant"}], injuries: ["Private medical detail"]});
  assert.equal(entry?.title, "Pioneering"); assert.equal(entry?.date, "2026-10-22"); assert.equal(entry?.time, "");
  assert.equal(entry?.state, "Completed"); assert.equal(entry?.path, "/leader/weekly?meeting=source");
  assert.equal(JSON.stringify(entry).includes("Private"), false);
});
test("event adapters retain inclusive date-only spans, state and canonical destinations", () => {
  const data = {section: "All Sections", startDate: "2026-10-22", endDate: "2026-10-24", title: "Camp", status: "completed", leaderNotes: "Private"};
  const entry = calendarSourceEntry("events", "camp", data)!;
  assert.equal(entry.endDate, "2026-10-24"); assert.equal(entry.section, "Group"); assert.equal(entry.state, "Completed"); assert.equal(entry.path, "/leader/events/camp");
  assert.equal(calendarSourceEntry("parentGalleryEvents", "camp", data)?.path, "/calendar/source/parentGalleryEvents/camp");
  assert.equal(calendarSourceEntry("publicEvents", "camp", {...data, endDate: ""})?.endDate, data.startDate);
  for (const changes of [{startDate: "2026-02-30"}, {endDate: "2026-10-20"}, {title: ""}, {section: ""}, {status: "unsupported"}]) assert.equal(calendarSourceEntry("events", "camp", {...data, ...changes}), null);
});
test("only local calendar month/type/section contexts are accepted as return destinations", () => {
  const path = "/calendar?month=2026-10&type=event&section=Scouts";
  assert.equal(calendarReturnPath({calendarReturnTo: path}), path);
  for (const value of ["https://example.invalid", "//example.invalid", "/leader/settings", "/calendar?next=https://example.invalid", "/calendar?month=2026-10#other", "/calendar\\?month=2026-10"]) assert.equal(calendarReturnPath({calendarReturnTo: value}), null);
  assert.equal(calendarReturnPath(null), null);
});
