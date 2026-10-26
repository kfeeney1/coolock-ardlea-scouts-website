import { test } from "node:test";
import assert from "node:assert/strict";
import { initialMeetingStage, meetingStage, meetingBadgeworkHref } from "../../src/services/meetingWorkflow.ts";

test("meeting entry stage follows meeting lifecycle and Ireland calendar date", () => {
  const today = "2026-10-25";
  assert.equal(meetingStage(initialMeetingStage("open", "2026-10-26", today)), "plan");
  assert.equal(meetingStage(initialMeetingStage("open", today, today)), "run");
  assert.equal(meetingStage(initialMeetingStage("open", "2026-10-24", today)), "review");
  assert.equal(meetingStage(initialMeetingStage("closed", "2026-10-26", today)), "review");
});

test("supported stage deep links restore Review context without changing the lifecycle default", () => {
  const today = "2026-10-26";
  assert.equal(initialMeetingStage("open", "2099-07-22", today, "review"), "badgework");
  assert.equal(initialMeetingStage("open", today, today, "plan"), "programme");
  assert.equal(initialMeetingStage("open", "2099-07-22", today, "run"), "attendance");
  assert.equal(initialMeetingStage("closed", today, today, "unknown"), "badgework");
  assert.equal(initialMeetingStage("open", "2099-07-22", today, "unknown"), "programme");
});

test("meeting tracker context contains present members only and preserves legacy or Review return", () => {
  const meeting = { id: "meeting-one", entries: [{ memberId: "present-one", attendance: "present" }, { memberId: "absent-one", attendance: "absent" }] } as Parameters<typeof meetingBadgeworkHref>[0];
  for (const redesigned of [false, true]) {
    const query = new URL(meetingBadgeworkHref(meeting, redesigned), "https://example.invalid").searchParams;
    assert.equal(query.get("memberIds"), "present-one");
    assert.equal(query.get("sourceId"), "meeting-one");
    assert.equal(query.get("returnTo"), `/leader/weekly?meeting=meeting-one${redesigned ? "&stage=review" : ""}`);
  }
  assert.equal(meetingBadgeworkHref(null, true), "/leader/badgework");
});
