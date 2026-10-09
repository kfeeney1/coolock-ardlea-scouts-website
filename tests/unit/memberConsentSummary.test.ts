import assert from "node:assert/strict";
import test from "node:test";

import { mapMemberConsentSummary } from "../../src/services/memberConsentSummaryLogic.ts";

test("member consent summaries include only linked youth consent and retain medical indicators", () => {
  const submittedAt = new Date("2026-10-08T18:30:00Z");
  const summary = mapMemberConsentSummary("consent-1", {
    formType: "youth-activity-consent",
    memberId: "member-1",
    childName: "  Alex Scout  ",
    childDOB: "2015-04-03",
    section: "Cubs",
    consentTo: "2027-08-31",
    submittedAt: { toDate: () => submittedAt },
    allergies: "Yes",
    medicationManagement: { enabled: true }
  }, "member-1");

  assert.deepEqual(summary, {
    consentId: "consent-1",
    memberName: "Alex Scout",
    dateOfBirth: "2015-04-03",
    section: "Cubs",
    consentTo: "2027-08-31",
    submittedAt,
    hasMedicalAlert: true,
    hasMedicationManagement: true
  });
});

test("member consent summaries exclude other form types and records linked to another member", () => {
  assert.equal(mapMemberConsentSummary("scouter", {
    formType: "scouter-consent",
    memberId: "member-1"
  }, "member-1"), null);
  assert.equal(mapMemberConsentSummary("other-member", {
    formType: "youth-activity-consent",
    memberId: "member-2"
  }, "member-1"), null);
});
