import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyMemberSummaries, newWeeklyEntry } from "../../src/services/weeklyTrackerLogic.ts";
import type { WeeklyMeetingRecord } from "../../src/services/weeklyTracker.ts";

const records: WeeklyMeetingRecord[] = [
  {
    id: "week-1",
    section: "Cubs",
    meetingDate: "2026-08-01",
    notes: "",
    entries: [
      { memberId: "m1", memberName: "Alex Scout", attendance: "present", subsPaid: true, subsAmount: 3, badges: ["Hiker"] },
      { memberId: "m2", memberName: "Jamie Scout", attendance: "absent", subsPaid: false, subsAmount: 0, badges: [] }
    ]
  },
  {
    id: "week-2",
    section: "Cubs",
    meetingDate: "2026-08-08",
    notes: "",
    entries: [
      { memberId: "m1", memberName: "Alex Scout", attendance: "absent", subsPaid: true, subsAmount: 3, badges: ["Hiker", "Teamwork"] },
      { memberId: "m2", memberName: "Jamie Scout", attendance: "unrecorded", subsPaid: true, subsAmount: 3, badges: ["Teamwork"] }
    ]
  }
];

test("buildWeeklyMemberSummaries calculates attendance, subs and unique badges", () => {
  const summaries = buildWeeklyMemberSummaries(records);
  const alex = summaries.find((item) => item.memberId === "m1");
  assert.ok(alex);
  assert.equal(alex.attendanceRate, 50);
  assert.equal(alex.subsPaidTotal, 6);
  assert.deepEqual(alex.badges, ["Hiker", "Teamwork"]);
});

test("unrecorded attendance is excluded from the attendance rate", () => {
  const summaries = buildWeeklyMemberSummaries(records);
  const jamie = summaries.find((item) => item.memberId === "m2");
  assert.ok(jamie);
  assert.equal(jamie.attendanceRate, 0);
  assert.equal(jamie.unrecorded, 1);
});

test("newWeeklyEntry starts with neutral defaults", () => {
  assert.deepEqual(newWeeklyEntry("member-1", "Sam Scout"), {
    memberId: "member-1",
    memberName: "Sam Scout",
    attendance: "unrecorded",
    subsPaid: false,
    subsAmount: 0,
    badges: []
  });
});
