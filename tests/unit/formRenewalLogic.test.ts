import assert from "node:assert/strict";
import test from "node:test";

import { findMembersNeedingFormRenewal, type FormRenewalConsent } from "../../src/services/formRenewalLogic.ts";

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

test("expired consent end date is due even when recently updated", () => {
  const due = findMembersNeedingFormRenewal(
    [{ id: "member-1", active: true }],
    [consent({ consentTo: "2026-09-11" })],
    asOf
  );
  assert.equal(due[0]?.reason, "expired");
});

test("parent update remains current until its annual anniversary", () => {
  const records = [consent({
    submittedAt: new Date("2024-01-01T10:00:00Z"),
    updatedAt: new Date("2024-01-01T10:00:00Z"),
    parentUpdatedAt: new Date("2026-09-13T10:00:00Z")
  })];
  assert.deepEqual(findMembersNeedingFormRenewal([{ id: "member-1", active: true }], records, asOf), []);
});

test("form is due on the one-year anniversary of the authoritative update", () => {
  const records = [consent({
    consentTo: "",
    parentUpdatedAt: new Date("2025-09-12T10:00:00Z")
  })];
  const due = findMembersNeedingFormRenewal([{ id: "member-1", active: true }], records, asOf);
  assert.equal(due[0]?.reason, "annual");
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
