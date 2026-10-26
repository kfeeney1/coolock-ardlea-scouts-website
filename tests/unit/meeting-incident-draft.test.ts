import assert from "node:assert/strict";
import test from "node:test";
import { emptyIncidentDraft, incidentDraftHasChanges, incidentFromDraft } from "../../src/services/meetingIncidentDraft.ts";
import type { WeeklyMeetingRecord } from "../../src/services/weeklyTracker";
const meeting = { injuries: [], entries: [{ memberId: "permitted", memberName: "Scoped member" }] } as WeeklyMeetingRecord;
test("incident drafts detect every entered field, including a selected member or changed severity", () => {
  const empty = emptyIncidentDraft(); assert.equal(incidentDraftHasChanges(empty), false);
  for (const patch of [{ memberId: "permitted" }, { concern: "Concern" }, { severity: "serious" as const }, { action: "Action" }, { parentInformed: true }]) assert.equal(incidentDraftHasChanges({ ...empty, ...patch }), true);
});
test("incident requires a current scoped member and concern, using authoritative member name and recorded time", () => {
  const draft = { ...emptyIncidentDraft(), memberId: "permitted", concern: " Minor concern ", action: "First aid", parentInformed: true };
  const incident = incidentFromDraft(meeting, draft, "2026-10-26T11:00:00Z");
  assert.deepEqual(incident, { memberId: "permitted", memberName: "Scoped member", concern: "Minor concern", actionTaken: "First aid", severity: "minor", parentInformed: true, recordedAt: "2026-10-26T11:00:00Z" });
  assert.throws(() => incidentFromDraft(meeting, { ...draft, memberId: "outside-scope" }), /Select a member/);
  assert.throws(() => incidentFromDraft(meeting, { ...draft, concern: "  " }), /concern/);
  assert.throws(() => incidentFromDraft(meeting, { ...draft, action: "x".repeat(2001) }), /2000/);
  assert.throws(() => incidentFromDraft({ ...meeting, injuries: Array(50).fill(incident) }, draft), /maximum 50/);
  assert.deepEqual(draft.concern, " Minor concern "); assert.equal(meeting.entries.length, 1);
});
