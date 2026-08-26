import assert from "node:assert/strict";
import test from "node:test";
import { buildMemberAttendanceHistory } from "../../src/services/attendanceInsightsLogic.ts";

const member = { id: "member-1", displayName: "Test Scout", section: "Scouts", status: "active" };
const events = [
  { id: "event-1", title: "Camp", startDate: "2099-01-20", section: "Scouts", status: "completed", attendance: { "member-1": "attending" } },
  { id: "event-2", title: "Other section", startDate: "2099-01-21", section: "Cubs", status: "completed", attendance: { "member-1": "attending" } },
];
const meetings = [
  { id: "meeting-1", section: "Scouts", meetingDate: "2099-01-15", status: "closed", entries: [{ memberId: "member-1", attendance: "present" }] },
  { id: "meeting-open", section: "Scouts", meetingDate: "2099-01-22", status: "open", entries: [{ memberId: "member-1", attendance: "present" }] },
];

test("member attendance history separates completed events from closed weekly meetings", () => {
  const history = buildMemberAttendanceHistory(member, events, meetings);
  assert.deepEqual(history.meetings, [{ id: "meeting-1", title: "Weekly Meeting", date: "2099-01-15", source: "meeting", status: "present" }]);
  assert.deepEqual(history.events, [{ id: "event-1", title: "Camp", date: "2099-01-20", source: "event", status: "attending" }]);
});

test("member attendance history applies an inclusive date range to both sources", () => {
  const history = buildMemberAttendanceHistory(member, events, meetings, { from: "2099-01-18", to: "2099-01-20" });
  assert.equal(history.meetings.length, 0);
  assert.deepEqual(history.events, [{ id: "event-1", title: "Camp", date: "2099-01-20", source: "event", status: "attending" }]);
});
