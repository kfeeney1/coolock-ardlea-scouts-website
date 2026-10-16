import assert from "node:assert/strict";
import test from "node:test";
import { groupLocalDate } from "../../src/services/groupLocalDate.ts";
import { groupParentMeetingsByDate, isCanonicalDateOnly } from "../../src/services/weeklyMeetingProgrammeLogic.ts";

const meetings = [
  { id: "next-later", meetingDate: "2026-10-20" },
  { id: "today", meetingDate: "2026-10-16" },
  { id: "previous-latest", meetingDate: "2026-10-15" },
  { id: "previous-older", meetingDate: "2026-10-01" },
  { id: "next-earlier", meetingDate: "2026-10-17" }
];

test("group date uses the group's Europe/Dublin calendar date across UTC boundaries", () => {
  assert.equal(groupLocalDate(new Date("2026-10-15T23:30:00.000Z")), "2026-10-16");
  assert.equal(groupLocalDate(new Date("2026-10-16T23:30:00.000Z")), "2026-10-17");
});

test("canonical date-only values are validated without parsing display strings or timestamps", () => {
  assert.equal(isCanonicalDateOnly("2026-10-16"), true);
  assert.equal(isCanonicalDateOnly("2026-02-30"), false);
  assert.equal(isCanonicalDateOnly("16-10-2026"), false);
  assert.equal(isCanonicalDateOnly("2026-10-16T00:00:00Z"), false);
});

test("today and future meetings are ascending, with one most recent previous and older history", () => {
  const views = groupParentMeetingsByDate(meetings, "2026-10-16");
  assert.deepEqual(views.upcoming.map(({ id }) => id), ["today", "next-earlier", "next-later"]);
  assert.deepEqual(views.previous.map(({ id }) => id), ["previous-latest"]);
  assert.deepEqual(views.historical.map(({ id }) => id), ["previous-older"]);
  assert.equal([...views.upcoming, ...views.previous].some(({ id }) => id === "previous-older"), false);
});

test("date partition handles empty, no-upcoming, no-previous, and no-history states", () => {
  assert.deepEqual(groupParentMeetingsByDate([], "2026-10-16"), { upcoming: [], previous: [], historical: [] });
  assert.deepEqual(groupParentMeetingsByDate([{ id: "old", meetingDate: "2026-10-15" }], "2026-10-16"), {
    upcoming: [], previous: [{ id: "old", meetingDate: "2026-10-15" }], historical: []
  });
  assert.deepEqual(groupParentMeetingsByDate([{ id: "today", meetingDate: "2026-10-16" }], "2026-10-16"), {
    upcoming: [{ id: "today", meetingDate: "2026-10-16" }], previous: [], historical: []
  });
});

test("invalid date values never enter the default or historical views", () => {
  const views = groupParentMeetingsByDate([
    { id: "valid", meetingDate: "2026-10-16" },
    { id: "invalid", meetingDate: "2026-13-01" }
  ], "2026-10-16");
  assert.deepEqual(views.upcoming.map(({ id }) => id), ["valid"]);
  assert.deepEqual(views.previous, []);
  assert.deepEqual(views.historical, []);
});
