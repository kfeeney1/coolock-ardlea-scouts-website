import test from "node:test";
import assert from "node:assert/strict";
import type { YouthConsentData } from "../../src/services/consentApplications.ts";
import { validateYouthConsent } from "../../src/services/youthConsentValidation.ts";

const base = (): YouthConsentData => ({
  scoutSection: "Cubs", childName: "Alex Scout", childDOB: "2015-01-02",
  consentFrom: "2026-09-01", consentTo: "2027-07-31",
  photoConsent: "Yes", waterActivities: "Yes", canSwim: "Yes",
  seriousIllness: "No", regularMeds: "No", medAllergies: "No", allergies: "No", dietaryReqs: "No", vaccinated: "Yes",
  medicalFurtherInfo: "", gpName: "Dr Test", gpTel: "012345678", gpAddress: "Clinic", lastCheckup: "",
  parent1Name: "Parent Scout", parent2Name: "", homePhone: "", mobile1: "0871234567", mobile2: "", workPhone: "",
  email: "parent@example.com", homeAddress: "Home", altContactName: "Other Adult", altContactPhone: "0861234567",
  additionalInfo: "", sig1Name: "Parent Scout", sig2Name: "", sigDate: "2026-09-01", declarationConfirmed: true,
  medicationManagement: { enabled: false, memberName: "", dateOfBirth: "", address: "", medicineName: "", dosage: "", frequency: "", quantitySupplied: "", doctorName: "", doctorTel: "", pharmacyName: "", pharmacyTel: "", method: "", otherInfo: "", selfAdmin: "", authFrom: "", authTo: "", scouter1: "", scouter2: "", signature: "", signatureDate: "" }
});

test("positive medical answer requires supporting details", () => {
  const data = base(); data.medAllergies = "Yes";
  assert.match(validateYouthConsent(data).medicalFurtherInfo ?? "", /Provide details/);
  data.medicalFurtherInfo = "Allergic to penicillin.";
  assert.equal(validateYouthConsent(data).medicalFurtherInfo, undefined);
});

test("canonical validation rejects missing parent, contact, GP and yes/no data", () => {
  const data = base(); data.parent1Name = ""; data.gpName = ""; data.mobile1 = ""; data.photoConsent = "";
  const errors = validateYouthConsent(data);
  assert.ok(errors.parent1Name); assert.ok(errors.gpName); assert.ok(errors.mobile1); assert.ok(errors.photoConsent);
});

test("canonical validation preserves legacy-compatible optional fields", () => {
  const data = base(); data.parent2Name = ""; data.homePhone = ""; data.workPhone = ""; data.lastCheckup = "";
  assert.deepEqual(validateYouthConsent(data), {});
});


test("SW-304 requires a second mobile only when a second parent is recorded", () => {
  const data = base(); data.parent2Name = "Second Parent";
  assert.ok(validateYouthConsent(data).mobile2);
  data.mobile2 = "0867654321";
  assert.equal(validateYouthConsent(data).mobile2, undefined);
});
