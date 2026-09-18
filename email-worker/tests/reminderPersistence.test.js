import assert from "node:assert/strict";
import test from "node:test";
import { reminderDocumentId, reminderRecord, shouldAttemptReminder } from "../src/reminderPersistence.js";

test("reminder document identity is stable per member recipient and consent episode", () => {
  const input = { memberId: "member-1", recipientUid: "parent-1", cycleKey: "expired:2025-09-17T00:00:00.000Z" };
  assert.equal(reminderDocumentId(input), reminderDocumentId(input));
  assert.notEqual(reminderDocumentId(input), reminderDocumentId({ ...input, recipientUid: "parent-2" }));
  assert.notEqual(reminderDocumentId(input), reminderDocumentId({ ...input, cycleKey: "expired:2026-09-17T00:00:00.000Z" }));
});

test("sent and in-flight reminders are deduplicated while failed reminders can retry", () => {
  assert.equal(shouldAttemptReminder(null), true);
  assert.equal(shouldAttemptReminder({ status: "failed" }), true);
  assert.equal(shouldAttemptReminder({ status: "sent" }), false);
  assert.equal(shouldAttemptReminder({ status: "sending" }), false);
});

test("reminder records contain lifecycle evidence but no medical contents", () => {
  assert.deepEqual(reminderRecord({ memberId: "m1", recipientUid: "p1", cycleKey: "missing:unknown", reason: "missing", status: "pending" }), {
    memberId: "m1",
    recipientUid: "p1",
    formType: "medical-consent",
    cycleKey: "missing:unknown",
    reason: "missing",
    status: "pending",
    attemptCount: 0,
    actionPath: "/parent",
    deliveryChannel: "email"
  });
});
