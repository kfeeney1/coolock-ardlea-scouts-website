import assert from "node:assert/strict";
import test from "node:test";
import { buildParentWeeklyMeetingProgramme, buildWeeklyMeetingWhatsAppText, mergeWeeklyMeetingShareBadgework } from "../../src/services/weeklyMeetingProgramme.ts";

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


test("SW-290 WhatsApp share includes completed meeting badgework without duplicates", () => {
  const programme = mergeWeeklyMeetingShareBadgework(buildParentWeeklyMeetingProgramme(source), [
    "Pioneering Stage 2",
    "Adventure Skills: Camping · Stage 1",
    "Adventure Skills: Camping · Stage 1"
  ]);
  const text = buildWeeklyMeetingWhatsAppText(programme);
  assert.match(text, /Activities \/ Games:\n• Wide game \(25 min\)/);
  assert.match(text, /Equipment: Cones and compass/);
  assert.match(text, /Badgework:/);
  assert.match(text, /• Pioneering \(30 min\)/);
  assert.match(text, /• Pioneering Stage 2/);
  assert.match(text, /• Adventure Skills: Camping · Stage 1/);
  assert.equal(text.match(/Adventure Skills: Camping · Stage 1/g)?.length, 1);
  assert.match(text, /Location: Scout Den/);
  assert.match(text, /Theme: Navigation Night/);
});

test("SW-290 WhatsApp share omits Badgework heading when no badgework exists", () => {
  const emptySource = { ...source, badgeworkPlan: [], entries: source.entries.map((entry) => ({ ...entry, badges: [] })) };
  const text = buildWeeklyMeetingWhatsAppText(mergeWeeklyMeetingShareBadgework(buildParentWeeklyMeetingProgramme(emptySource), []));
  assert.equal(text.includes("Badgework:"), false);
  assert.match(text, /Activities \/ Games:/);
  assert.match(text, /Equipment: Cones and compass/);
});
