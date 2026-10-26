import { test } from "node:test";
import assert from "node:assert/strict";
import { initialMeetingStage, meetingStage } from "../../src/services/meetingWorkflow.ts";

test("meeting entry stage follows meeting lifecycle and Ireland calendar date", () => {
  const today = "2026-10-25";
  assert.equal(meetingStage(initialMeetingStage("open", "2026-10-26", today)), "plan");
  assert.equal(meetingStage(initialMeetingStage("open", today, today)), "run");
  assert.equal(meetingStage(initialMeetingStage("open", "2026-10-24", today)), "review");
  assert.equal(meetingStage(initialMeetingStage("closed", "2026-10-26", today)), "review");
});
