import assert from "node:assert/strict";
import test from "node:test";

import { memberDraftFromYouthConsent } from "../../src/services/consentMemberOnboardingLogic.ts";

test("SW-218 maps a production-shaped Venture consent to a canonical member", () => {
  const draft = memberDraftFromYouthConsent({
    formType: "youth-activity-consent",
    childName: "Cara Cullen",
    childDOB: "2011-05-12",
    section: "Ventures",
    parent1Name: "Parent Cullen",
    email: "PARENT@EXAMPLE.COM",
    mobile1: "0870000000",
    altContactName: "Emergency Contact",
    altContactPhone: "0860000000"
  });
  assert.deepEqual(draft, {
    firstName: "Cara",
    lastName: "Cullen",
    displayName: "Cara Cullen",
    dateOfBirth: "2011-05-12",
    section: "Ventures",
    parentName: "Parent Cullen",
    emailAddress: "parent@example.com",
    mobileNumber: "0870000000",
    emergencyContactName: "Emergency Contact",
    emergencyContactPhone: "0860000000"
  });
});

test("SW-218 supports every canonical youth section through consent onboarding", () => {
  for (const section of ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]) {
    assert.equal(memberDraftFromYouthConsent({ childName: "Test Member", childDOB: "2012-01-01", section }).section, section);
  }
});

test("SW-218 refuses incomplete or non-youth consent identity data", () => {
  assert.throws(() => memberDraftFromYouthConsent({ childName: "Cara", childDOB: "2011-05-12", section: "Ventures" }), /first name and surname/);
  assert.throws(() => memberDraftFromYouthConsent({ childName: "Cara Cullen", section: "Ventures" }), /date of birth/);
  assert.throws(() => memberDraftFromYouthConsent({ childName: "Cara Cullen", childDOB: "2011-05-12", section: "Scouter" }), /canonical youth section/);
});
