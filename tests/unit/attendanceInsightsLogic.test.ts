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

test("uses completed events only and calculates recorded attendance rate", () => {
    const rows = buildMemberAttendanceInsights(members, events);
    const aoife = rows.find((row) => row.memberId === "m1");
    assert.deepEqual(aoife, {
        memberId: "m1",
        displayName: "Aoife",
        section: "Scouts",
        completedEvents: 2,
        attended: 2,
        notAttended: 0,
        unrecorded: 0,
        attendanceRate: 100,
        lastRecordedDate: "2026-06-01",
        lastAttendanceStatus: "attending"
    });
});

test("tracks missing roster values separately and excludes inactive members", () => {
    const rows = buildMemberAttendanceInsights(members, events);
    const ben = rows.find((row) => row.memberId === "m2");
    assert.equal(ben?.attendanceRate, 0);
    assert.equal(ben?.unrecorded, 1);
    assert.equal(rows.some((row) => row.memberId === "m3"), false);
});
