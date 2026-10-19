import assert from "node:assert/strict";
import test from "node:test";
import { buildAttendanceMatrix } from "../../src/services/attendanceMatrixLogic.ts";
import type { AttendanceInsightMember, AttendanceInsightMeeting } from "../../src/services/attendanceInsightsLogic.ts";
const members: AttendanceInsightMember[] = [
  { id: "z", displayName: "Amy Zulu", firstName: "Amy", lastName: "Zulu", section: "Cubs", sections: ["Cubs"], status: "active" },
  { id: "a", displayName: "Zoe Alpha", firstName: "Zoe", lastName: "Alpha", section: "Scouts", sections: ["Scouts", "Cubs"], status: "active" },
  { id: "b", displayName: "Bea Beta", firstName: "Bea", lastName: "Beta", section: "Scouts", sections: ["Scouts"], status: "active" },
  { id: "left", displayName: "Left", section: "Scouts", sections: [], status: "left" }
];
const meetings: AttendanceInsightMeeting[] = [
  { id: "later", section: "Scouts", meetingDate: "2026-10-02", theme: "Navigation", status: "closed", entries: [{ memberId: "a", attendance: "absent" }] },
  { id: "first", section: "Cubs", meetingDate: "2026-10-01", status: "closed", entries: [{ memberId: "z", attendance: "present" }, { memberId: "a", attendance: "unrecorded" }] },
  { id: "open", section: "Cubs", meetingDate: "2026-10-03", status: "open", entries: [] }
];
test("stable IDs, canonical surnames, chronology and all supported states survive persisted reload", () => {
  const before = JSON.stringify({ members, meetings });
  const matrix = buildAttendanceMatrix(members, meetings);
  assert.deepEqual(matrix.rows.map(row => row.memberId), ["a", "b", "z"]);
  assert.deepEqual(matrix.meetings.map(meeting => meeting.id), ["first", "later"]);
  assert.equal(matrix.meetings[1].title, "Navigation");
  assert.deepEqual(matrix.rows.map(row => row.states), [["unrecorded", "absent"], ["not-applicable", "unrecorded"], ["present", "not-applicable"]]);
  const reloaded = JSON.parse(before);
  assert.deepEqual(buildAttendanceMatrix(reloaded.members, reloaded.meetings), matrix);
  assert.equal(JSON.stringify({ members, meetings }), before);
});
test("section/date/search filters apply to concurrent members and meeting columns", () => {
  const matrix = buildAttendanceMatrix(members, meetings, { section: "Cubs", from: "2026-10-01", to: "2026-10-01", search: "Zoe" });
  assert.deepEqual(matrix.rows.map(row => row.memberId), ["a"]);
  assert.deepEqual(matrix.meetings.map(meeting => meeting.id), ["first"]);
  assert.equal(buildAttendanceMatrix(members, meetings, { section: "Beavers" }).meetings.length, 0);
  assert.equal(buildAttendanceMatrix(members, meetings, { from: "2026-11-01" }).meetings.length, 0);
});


test("persisted historical roster entries survive later membership changes", () => {
  const moved = [{ ...members[1], sections: ["Scouts"] }];
  const history = meetings.map(meeting => meeting.id === "first" ? { ...meeting, entries: [{ memberId: "a", attendance: "present" }] } : meeting);
  const matrix = buildAttendanceMatrix(moved, history);
  assert.deepEqual(matrix.meetings.map(meeting => meeting.id), ["first", "later"]);
  assert.deepEqual(matrix.rows[0].states, ["present", "absent"]);
  history[1].entries[0].attendance = "unrecorded";
  assert.equal(buildAttendanceMatrix(moved, history).rows[0].states[0], "unrecorded");
  history[1].entries = [];
  assert.equal(buildAttendanceMatrix(moved, history).rows[0].states[0], "not-applicable");
});
