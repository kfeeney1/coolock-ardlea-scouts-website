import assert from "node:assert/strict";
import test from "node:test";
import { buildLeaderToday, joinApplicationOverviewSections } from "../../src/services/adminOverviewLogic.ts";

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
  assert.equal(result.attentionItems[0].label, "Scouts meeting from 20-08-2026 is still open");
  assert.equal(result.attentionItems[1].label, "Scouts meeting on 27-08-2026 has no programme");
  assert.equal(result.attentionItems[3].detail, "Event date: 12-09-2026");
});

test("leader today stays clear when nothing needs attention", () => {
  const result = buildLeaderToday([
    { id: "ready", section: "Cubs", meetingDate: "2026-08-28", status: "open", location: "Den", programmeReady: true, attendanceStarted: false }
  ], [], "2026-08-27");
  assert.equal(result.nextMeeting?.id, "ready");
  assert.equal(result.attentionItems.length, 0);
});


test("SW-358 limits join application overview sections to backend-authorized appointments", () => {
  const combinedAppointment = {
    uid: "champion", email: "", displayName: "Champion", role: "leader" as const,
    sections: ["Beavers", "Scouts"], scoutingRole: "Group Youth Champion", uiTheme: "light" as const,
    appointments: [
      { id: "section-leader--scouts", appointment: "Section Leader" as const, scope: "Scouts", active: true },
      { id: "group-youth-champion--group", appointment: "Group Youth Champion" as const, scope: "Group", active: true }
    ]
  };
  assert.deepEqual(joinApplicationOverviewSections(combinedAppointment), ["Scouts"]);
  assert.deepEqual(joinApplicationOverviewSections({
    ...combinedAppointment,
    scoutingRole: "Section Leader",
    appointments: [combinedAppointment.appointments[0]]
  }), ["Scouts"]);
  assert.deepEqual(joinApplicationOverviewSections({
    ...combinedAppointment,
    role: "leader",
    scoutingRole: "Programme Scouter",
    appointments: [{ id: "programme-scouter--scouts", appointment: "Programme Scouter", scope: "Scouts", active: true }]
  }), []);
  assert.deepEqual(joinApplicationOverviewSections({
    ...combinedAppointment,
    scoutingRole: "Group Leader",
    appointments: [{ id: "group-leader--group", appointment: "Group Leader", scope: "Group", active: true }]
  }), ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]);
  assert.deepEqual(joinApplicationOverviewSections({
    ...combinedAppointment,
    role: "admin",
    scoutingRole: "",
    appointments: []
  }), ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]);
});
