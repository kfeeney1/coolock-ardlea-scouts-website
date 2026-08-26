import assert from "node:assert/strict";
import test from "node:test";

import { buildMemberAttendanceInsights } from "../../src/services/attendanceInsightsLogic.ts";

const members = [
    { id: "m1", displayName: "Aoife", section: "Scouts", status: "active" },
    { id: "m2", displayName: "Ben", section: "Scouts", status: "active" },
    { id: "m3", displayName: "Cara", section: "Cubs", status: "inactive" }
];

const events = [
    { id: "e1", title: "Camp", startDate: "2026-06-01", section: "Scouts", status: "completed", attendance: { m1: "attending", m2: "not-attending" } },
    { id: "e2", title: "Hike", startDate: "2026-05-01", section: "Scouts", status: "completed", attendance: { m1: "attending" } },
    { id: "e3", title: "Future", startDate: "2026-09-01", section: "Scouts", status: "open", attendance: { m1: "not-attending" } }
];

const meetings = [
    { id: "w1", section: "Scouts", meetingDate: "2026-06-10", status: "closed", entries: [{ memberId: "m1", attendance: "absent" }, { memberId: "m2", attendance: "present" }] },
    { id: "w2", section: "Scouts", meetingDate: "2026-04-10", status: "closed", entries: [{ memberId: "m1", attendance: "present" }] },
    { id: "w3", section: "Scouts", meetingDate: "2026-07-10", status: "open", entries: [{ memberId: "m1", attendance: "present" }] }
];

test("calculates separate meeting, event and combined recorded attendance rates", () => {
    const rows = buildMemberAttendanceInsights(members, events, meetings);
    const aoife = rows.find((row) => row.memberId === "m1");
    assert.deepEqual(aoife, {
        memberId: "m1",
        displayName: "Aoife",
        section: "Scouts",
        meeting: { attended: 1, notAttended: 1, unrecorded: 0, recorded: 2, rate: 50 },
        event: { attended: 2, notAttended: 0, unrecorded: 0, recorded: 2, rate: 100 },
        combined: { attended: 3, notAttended: 1, unrecorded: 0, recorded: 4, rate: 75 },
        lastRecordedDate: "2026-06-10",
        lastRecordedSource: "meeting",
        lastAttendanceStatus: "not-attended"
    });
});

test("tracks unrecorded values, excludes inactive members and respects date range", () => {
    const rows = buildMemberAttendanceInsights(members, events, meetings, { from: "2026-05-15", to: "2026-06-30" });
    const ben = rows.find((row) => row.memberId === "m2");
    assert.equal(ben?.meeting.rate, 100);
    assert.equal(ben?.event.rate, 0);
    assert.equal(ben?.combined.rate, 50);
    assert.equal(ben?.combined.unrecorded, 0);
    assert.equal(rows.some((row) => row.memberId === "m3"), false);
});
