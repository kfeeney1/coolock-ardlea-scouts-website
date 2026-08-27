import assert from "node:assert/strict";
import test from "node:test";
import { buildLeaderToday } from "../../src/services/adminOverviewLogic.ts";

const meetings = [
  { id: "past", section: "Scouts", meetingDate: "2026-08-20", status: "open", location: "Den", programmeReady: true, attendanceStarted: true },
  { id: "next", section: "Scouts", meetingDate: "2026-08-27", status: "open", location: "Hall", programmeReady: false, attendanceStarted: false },
  { id: "later", section: "Scouts", meetingDate: "2026-09-03", status: "open", location: "Hall", programmeReady: true, attendanceStarted: false }
];

const events = [
  { id: "camp", title: "Autumn Camp", startDate: "2026-09-12", outstandingConsent: 3 },
  { id: "walk", title: "Hill Walk", startDate: "2026-09-20", outstandingConsent: 0 }
];

test("leader today picks the next open meeting", () => {
  const result = buildLeaderToday(meetings, events, "2026-08-27");
  assert.equal(result.nextMeeting?.id, "next");
});

test("leader today surfaces overdue meetings, missing programme, today's attendance and consent", () => {
  const result = buildLeaderToday(meetings, events, "2026-08-27");
  const ids = result.attentionItems.map((item) => item.id);
  assert.deepEqual(ids, [
    "meeting-open-past",
    "meeting-programme-next",
    "meeting-attendance-next",
    "event-consent-camp"
  ]);
});

test("leader today stays clear when nothing needs attention", () => {
  const result = buildLeaderToday([
    { id: "ready", section: "Cubs", meetingDate: "2026-08-28", status: "open", location: "Den", programmeReady: true, attendanceStarted: false }
  ], [], "2026-08-27");
  assert.equal(result.nextMeeting?.id, "ready");
  assert.equal(result.attentionItems.length, 0);
});
