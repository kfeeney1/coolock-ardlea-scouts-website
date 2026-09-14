import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFormReminderCandidates,
  buildScouterFormReminderCandidates,
  formReminderCycleKey
} from "../../src/services/formReminderLogic.ts";
import type { FormRenewalDue, ScouterFormRenewalDue } from "../../src/services/formRenewalLogic.ts";

const expired: FormRenewalDue = {
  memberId: "child-a",
  reason: "annual",
  referenceDate: new Date("2025-09-01T12:00:00Z")
};

const expiredScouter: ScouterFormRenewalDue = {
  leaderUid: "leader-a",
  reason: "annual",
  referenceDate: new Date("2025-09-01T12:00:00Z")
};

test("routes renewal only to approved parents explicitly linked to the child", () => {
  const candidates = buildFormReminderCandidates([expired], [
    { uid: "parent-a", status: "approved", memberIds: ["child-a"] },
    { uid: "parent-b", status: "approved", memberIds: ["child-b"] },
    { uid: "parent-disabled", status: "revoked", memberIds: ["child-a"] }
  ]);
  assert.deepEqual(candidates, [{
    recipientUid: "parent-a",
    memberId: "child-a",
    reason: "annual",
    cycleKey: "annual:2025-09-01T12:00:00.000Z"
  }]);
});

test("multiple authorised guardians each receive their own candidate", () => {
  const candidates = buildFormReminderCandidates([expired], [
    { uid: "parent-a", status: "approved", memberIds: ["child-a"] },
    { uid: "parent-b", status: "approved", memberIds: ["child-a"] }
  ]);
  assert.deepEqual(candidates.map((candidate) => candidate.recipientUid), ["parent-a", "parent-b"]);
});

test("a sent reminder suppresses only the same recipient, child and renewal cycle", () => {
  const cycleKey = formReminderCycleKey(expired);
  const candidates = buildFormReminderCandidates([expired], [
    { uid: "parent-a", status: "approved", memberIds: ["child-a"] },
    { uid: "parent-b", status: "approved", memberIds: ["child-a"] }
  ], [{ recipientUid: "parent-a", memberId: "child-a", cycleKey, status: "sent" }]);
  assert.deepEqual(candidates.map((candidate) => candidate.recipientUid), ["parent-b"]);
});

test("failed reminders remain eligible for retry", () => {
  const cycleKey = formReminderCycleKey(expired);
  assert.equal(buildFormReminderCandidates([expired], [
    { uid: "parent-a", status: "approved", memberIds: ["child-a"] }
  ], [{ recipientUid: "parent-a", memberId: "child-a", cycleKey, status: "failed" }]).length, 1);
});

test("renewing a form creates a new reminder cycle", () => {
  const oldCycle = formReminderCycleKey(expired);
  const renewed: FormRenewalDue = {
    memberId: "child-a",
    reason: "annual",
    referenceDate: new Date("2026-09-01T12:00:00Z")
  };
  assert.equal(buildFormReminderCandidates([renewed], [
    { uid: "parent-a", status: "approved", memberIds: ["child-a"] }
  ], [{ recipientUid: "parent-a", memberId: "child-a", cycleKey: oldCycle, status: "sent" }]).length, 1);
});

test("missing forms use a stable unknown cycle until a form is completed", () => {
  assert.equal(formReminderCycleKey({ memberId: "child-a", reason: "missing", referenceDate: null }), "missing:unknown");
});

test("Scouter renewal routes only to the same active leader identity", () => {
  assert.deepEqual(buildScouterFormReminderCandidates([expiredScouter], [
    { uid: "leader-a", active: true },
    { uid: "leader-b", active: true }
  ]), [{
    recipientUid: "leader-a",
    leaderUid: "leader-a",
    reason: "annual",
    cycleKey: "annual:2025-09-01T12:00:00.000Z"
  }]);
});

test("disabled leaders never receive Scouter renewal candidates", () => {
  assert.deepEqual(buildScouterFormReminderCandidates([expiredScouter], [
    { uid: "leader-a", active: false }
  ]), []);
});

test("Scouter reminder deduplication suppresses sent cycles and retries failed cycles", () => {
  const cycleKey = formReminderCycleKey(expiredScouter);
  assert.equal(buildScouterFormReminderCandidates([expiredScouter], [
    { uid: "leader-a", active: true }
  ], [{ recipientUid: "leader-a", leaderUid: "leader-a", cycleKey, status: "sent" }]).length, 0);
  assert.equal(buildScouterFormReminderCandidates([expiredScouter], [
    { uid: "leader-a", active: true }
  ], [{ recipientUid: "leader-a", leaderUid: "leader-a", cycleKey, status: "failed" }]).length, 1);
});
