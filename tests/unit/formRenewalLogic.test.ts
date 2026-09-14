import assert from "node:assert/strict";
import test from "node:test";

import {
  authoritativeFormCompletionDate,
  evaluateMemberFormLifecycle,
  evaluateScouterFormLifecycle,
  findLeadersNeedingFormRenewal,
  findMembersNeedingFormRenewal,
  type FormRenewalConsent
} from "../../src/services/formRenewalLogic.ts";

const asOf = new Date("2026-09-12T12:00:00Z");

function consent(overrides: Partial<FormRenewalConsent> = {}): FormRenewalConsent {
  return {
    memberId: "member-1",
    formType: "youth-activity-consent",
    status: "active",
    consentTo: "2027-01-01",
    submittedAt: new Date("2026-02-01T10:00:00Z"),
    updatedAt: new Date("2026-02-01T10:00:00Z"),
    parentUpdatedAt: new Date("2026-02-01T10:00:00Z"),
    ...overrides
  };
}

test("active member with no youth form needs renewal", () => {
  assert.deepEqual(findMembersNeedingFormRenewal([{ id: "member-1", active: true }], [], asOf), [{
    memberId: "member-1",
    reason: "missing",
    referenceDate: null
  }]);
});

test("inactive members are excluded", () => {
  assert.deepEqual(findMembersNeedingFormRenewal([{ id: "member-1", active: false }], [], asOf), []);
});

test("expired consent end date is due even when recently renewed", () => {
  const due = findMembersNeedingFormRenewal(
    [{ id: "member-1", active: true }],
    [consent({ consentTo: "2026-09-11" })],
    asOf
  );
  assert.equal(due[0]?.reason, "expired");
});

test("consent end date remains current on the stated valid-until day", () => {
  const lifecycle = evaluateMemberFormLifecycle(
    { id: "member-1", active: true },
    [consent({ consentTo: "2026-09-12" })],
    asOf
  );
  assert.equal(lifecycle?.status, "current");
});

test("parent renewal remains current until its annual anniversary", () => {
  const records = [consent({
    consentTo: "",
    submittedAt: new Date("2024-01-01T10:00:00Z"),
    updatedAt: new Date("2024-01-01T10:00:00Z"),
    parentUpdatedAt: new Date("2026-09-12T10:00:00Z")
  })];
  assert.deepEqual(findMembersNeedingFormRenewal([{ id: "member-1", active: true }], records, asOf), []);
});

test("form remains current exactly one year after completion", () => {
  const anniversary = new Date("2025-09-12T10:00:00Z");
  const lifecycle = evaluateMemberFormLifecycle(
    { id: "member-1", active: true },
    [consent({ consentTo: "", submittedAt: anniversary, updatedAt: anniversary, parentUpdatedAt: null })],
    asOf
  );
  assert.equal(lifecycle?.status, "current");
  assert.equal(lifecycle?.validUntil?.toISOString(), "2026-09-12T00:00:00.000Z");
});

test("form requires renewal immediately after the one-year validity boundary", () => {
  const lifecycle = evaluateMemberFormLifecycle(
    { id: "member-1", active: true },
    [consent({
      consentTo: "",
      submittedAt: new Date("2025-09-11T10:00:00Z"),
      updatedAt: new Date("2026-09-11T10:00:00Z"),
      parentUpdatedAt: null
    })],
    asOf
  );
  assert.equal(lifecycle?.status, "renewal-required");
  assert.equal(lifecycle?.reason, "annual");
});

test("generic administrative updatedAt never extends form validity", () => {
  const record = consent({
    consentTo: "",
    submittedAt: new Date("2025-01-01T10:00:00Z"),
    parentUpdatedAt: null,
    updatedAt: new Date("2026-09-12T10:00:00Z")
  });
  assert.equal(authoritativeFormCompletionDate(record)?.toISOString(), "2025-01-01T10:00:00.000Z");
  assert.equal(evaluateMemberFormLifecycle({ id: "member-1", active: true }, [record], asOf)?.status, "renewal-required");
});

test("parentUpdatedAt is authoritative when a parent actually renews the form", () => {
  const record = consent({
    consentTo: "",
    submittedAt: new Date("2024-01-01T10:00:00Z"),
    updatedAt: new Date("2024-01-01T10:00:00Z"),
    parentUpdatedAt: new Date("2026-09-11T10:00:00Z")
  });
  assert.equal(authoritativeFormCompletionDate(record)?.toISOString(), "2026-09-11T10:00:00.000Z");
  assert.equal(evaluateMemberFormLifecycle({ id: "member-1", active: true }, [record], asOf)?.status, "current");
});

test("legacy form with no trustworthy completion timestamp requires renewal", () => {
  const lifecycle = evaluateMemberFormLifecycle(
    { id: "member-1", active: true },
    [consent({ consentTo: "", submittedAt: null, parentUpdatedAt: null, updatedAt: new Date("2026-09-12T10:00:00Z") })],
    asOf
  );
  assert.equal(lifecycle?.status, "renewal-required");
  assert.equal(lifecycle?.referenceDate, null);
});

test("malformed legacy consentTo does not invent an expiry date", () => {
  const lifecycle = evaluateMemberFormLifecycle(
    { id: "member-1", active: true },
    [consent({ consentTo: "not-a-date", submittedAt: new Date("2026-01-01T10:00:00Z"), parentUpdatedAt: null })],
    asOf
  );
  assert.equal(lifecycle?.status, "current");
  assert.equal(lifecycle?.validUntil?.toISOString(), "2027-01-01T00:00:00.000Z");
});

test("29 February completion clamps annual validity to 28 February next year", () => {
  const lifecycle = evaluateMemberFormLifecycle(
    { id: "member-1", active: true },
    [consent({ consentTo: "", submittedAt: new Date("2024-02-29T12:00:00Z"), parentUpdatedAt: null })],
    new Date("2025-02-28T12:00:00Z")
  );
  assert.equal(lifecycle?.status, "current");
  assert.equal(lifecycle?.validUntil?.toISOString(), "2025-02-28T00:00:00.000Z");
  assert.equal(evaluateMemberFormLifecycle(
    { id: "member-1", active: true },
    [consent({ consentTo: "", submittedAt: new Date("2024-02-29T12:00:00Z"), parentUpdatedAt: null })],
    new Date("2025-03-01T12:00:00Z")
  )?.status, "renewal-required");
});

test("newest non-archived youth form controls renewal and scouter forms are ignored", () => {
  const records = [
    consent({ parentUpdatedAt: new Date("2024-01-01T10:00:00Z") }),
    consent({ parentUpdatedAt: new Date("2026-08-01T10:00:00Z") }),
    consent({ formType: "scouter-es3-medical-advice", parentUpdatedAt: new Date("2024-01-01T10:00:00Z") }),
    consent({ status: "archived", parentUpdatedAt: new Date("2026-09-12T10:00:00Z") })
  ];
  assert.deepEqual(findMembersNeedingFormRenewal([{ id: "member-1", active: true }], records, asOf), []);
});

test("linked Scouter ES3 uses the same one-year lifecycle", () => {
  const record = consent({
    memberId: "",
    formType: "scouter-es3-medical-advice",
    consentTo: "",
    submittedByUid: "leader-a",
    submittedAt: new Date("2025-09-11T10:00:00Z"),
    parentUpdatedAt: null
  });
  assert.deepEqual(findLeadersNeedingFormRenewal([{ uid: "leader-a", active: true }], [record], asOf), [{
    leaderUid: "leader-a",
    reason: "annual",
    referenceDate: new Date("2025-09-11T10:00:00Z")
  }]);
});

test("Scouter ES3 stays current on the anniversary boundary", () => {
  const record = consent({
    memberId: "",
    formType: "scouter-es3-medical-advice",
    consentTo: "",
    submittedByUid: "leader-a",
    submittedAt: new Date("2025-09-12T10:00:00Z"),
    parentUpdatedAt: null
  });
  assert.equal(evaluateScouterFormLifecycle({ uid: "leader-a", active: true }, [record], asOf)?.status, "current");
});

test("inactive leaders are excluded from Scouter renewal", () => {
  const record = consent({
    memberId: "",
    formType: "scouter-es3-medical-advice",
    consentTo: "",
    submittedByUid: "leader-a",
    submittedAt: new Date("2024-01-01T10:00:00Z"),
    parentUpdatedAt: null
  });
  assert.deepEqual(findLeadersNeedingFormRenewal([{ uid: "leader-a", active: false }], [record], asOf), []);
});

test("optional Scouter ES3 absence and unlinked legacy records are not guessed as overdue", () => {
  const legacy = consent({
    memberId: "",
    formType: "scouter-es3-medical-advice",
    consentTo: "",
    submittedByUid: undefined,
    submittedAt: new Date("2024-01-01T10:00:00Z"),
    parentUpdatedAt: null
  });
  assert.equal(evaluateScouterFormLifecycle({ uid: "leader-a", active: true }, [], asOf), null);
  assert.deepEqual(findLeadersNeedingFormRenewal([{ uid: "leader-a", active: true }], [legacy], asOf), []);
});
