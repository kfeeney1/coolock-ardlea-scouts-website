import assert from "node:assert/strict";
import test from "node:test";
import { buildParentWeeklyMeetingProgramme, buildWeeklyMeetingWhatsAppText } from "../../src/services/weeklyMeetingProgramme.ts";

const source = {
  section: "Scouts",
  meetingDate: "2099-03-01",
  status: "open" as const,
  location: "Scout Den",
  theme: "Navigation Night",
  activities: [{ activity: "Wide game", durationMinutes: 25, leader: "Private Leader", notes: "Private instructions", equipment: "Cones and compass" }],
  badgeworkPlan: [{ badge: "Pioneering", durationMinutes: 30, leader: "Private Leader", notes: "Private badge notes", equipment: "Rope" }],
  programmeNotes: "Leader-only programme note",
  notes: "Post-meeting note",
  entries: [{ memberId: "member-1", memberName: "Child Name", attendance: "present", subsPaid: true, subsAmount: 5, badges: ["Completed Badge"] }],
  injuries: [{ memberId: "member-1", memberName: "Child Name", concern: "Private injury" }],
};

test("parent meeting projection contains only parent-facing programme fields", () => {
  const projection = buildParentWeeklyMeetingProgramme(source);
  assert.deepEqual(Object.keys(projection).sort(), ["activities", "badgework", "location", "meetingDate", "section", "status", "theme"].sort());
  assert.deepEqual(projection.activities, [{ name: "Wide game", durationMinutes: 25, equipment: "Cones and compass" }]);
  assert.deepEqual(projection.badgework, [{ name: "Pioneering", durationMinutes: 30, equipment: "Rope" }]);
});

test("WhatsApp meeting text includes equipment but excludes attendance, incidents and leader-only detail", () => {
  const text = buildWeeklyMeetingWhatsAppText(buildParentWeeklyMeetingProgramme(source));
  assert.match(text, /Wide game/);
  assert.match(text, /Pioneering/);
  assert.match(text, /Equipment: Cones and compass/);
  assert.match(text, /Equipment: Rope/);
  for (const privateValue of ["Child Name", "Completed Badge", "Private injury", "Private Leader", "Private instructions", "Leader-only programme note", "Post-meeting note"]) {
    assert.equal(text.includes(privateValue), false, `${privateValue} must not appear in the share text`);
  }
});
