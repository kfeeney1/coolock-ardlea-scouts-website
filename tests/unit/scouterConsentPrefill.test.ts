import assert from "node:assert/strict";
import test from "node:test";

import type { ScouterConsentData } from "../../src/services/consentApplications.ts";
import { mergeScouterConsentPrefill } from "../../src/services/scouterConsentPrefillLogic.ts";
import type { LeaderMedicalDefaults } from "../../src/services/leaderProfile.ts";

const initial = {
  scoutSection: "Scouter", name: "", dob: "", address: "", mobile: "", homePhone: "", workPhone: "",
  nextOfKinName: "", nextOfKinAddress: "", nextOfKinMobile: "", nextOfKinHome: "", nextOfKinWork: "",
  epilepsy: "", diabetes: "", asthma: "", heartDisease: "", highBloodPressure: "", skinAllergies: "", hearingDifficulties: "",
  otherMedical: "", previousInjuries: "", onMedication: "", medicationDetails: "", allergies: "", signature: "Old signature",
  signatureDate: "2026-10-11", declarationConfirmed: true,
  medicationManagement: { enabled: false, memberName: "", dateOfBirth: "", address: "", medicineName: "", dosage: "", frequency: "", quantitySupplied: "", doctorName: "", doctorTel: "", pharmacyName: "", pharmacyTel: "", method: "", otherInfo: "", selfAdmin: "", authFrom: "2026-10-11", authTo: "2027-08-31", scouter1: "", scouter2: "", signature: "Old nested signature", signatureDate: "2026-10-11" }
} as unknown as ScouterConsentData;

const profile: LeaderMedicalDefaults = {
  name: "Scouts Programme Scouter", dob: "1985-04-12", address: "42 Test Scouter Road",
  mobile: "0861234567", homePhone: "012345678", workPhone: "019876543"
};

test("new Scouter form inherits every supported signed-in profile field and retains date-only values", () => {
  const result = mergeScouterConsentPrefill(initial, null, profile);
  assert.deepEqual([result.name, result.dob, result.address, result.mobile, result.homePhone, result.workPhone], [
    "Scouts Programme Scouter", "1985-04-12", "42 Test Scouter Road", "0861234567", "012345678", "019876543"
  ]);
});

test("saved consent values win over changed profile defaults while empty fields can use profile defaults", () => {
  const result = mergeScouterConsentPrefill(initial, {
    name: "Saved Scouter Name", dob: "1980-09-01", address: "Saved Address", mobile: "0855550000", homePhone: "", workPhone: ""
  }, { ...profile, name: "Updated Profile Name", mobile: "0869999999", homePhone: "013333333" });
  assert.equal(result.name, "Saved Scouter Name");
  assert.equal(result.dob, "1980-09-01");
  assert.equal(result.address, "Saved Address");
  assert.equal(result.mobile, "0855550000");
  assert.equal(result.homePhone, "013333333");
  assert.equal(result.workPhone, profile.workPhone);
});

test("missing profile fields stay blank and remain available for manual entry", () => {
  const result = mergeScouterConsentPrefill(initial, null, { name: "", dob: "", address: "", mobile: "", homePhone: "", workPhone: "" });
  for (const field of ["name", "dob", "address", "mobile", "homePhone", "workPhone"] as const) assert.equal(result[field], "");
});

test("partial saved data and edits made during late profile loading are retained", () => {
  const draft = { ...initial, name: "Edited While Loading", mobile: "" };
  const result = mergeScouterConsentPrefill(draft, { address: "Saved Draft Address", asthma: "No" }, profile, new Set(["name", "mobile"]));
  assert.equal(result.name, "Edited While Loading");
  assert.equal(result.mobile, "");
  assert.equal(result.address, "Saved Draft Address");
  assert.equal(result.asthma, "No");
  assert.equal(result.dob, profile.dob);
});

test("renewal reuses previous details but never carries a previous signature or declaration forward", () => {
  const result = mergeScouterConsentPrefill(initial, {
    name: "Saved Scouter Name", signature: "Previous Approval", declarationConfirmed: true,
    medicationManagement: { enabled: true, signature: "Nested Previous Approval", signatureDate: "2025-10-01", medicineName: "Example" }
  }, profile);
  assert.equal(result.name, "Saved Scouter Name");
  assert.equal(result.signature, "");
  assert.equal(result.declarationConfirmed, false);
  assert.equal(result.medicationManagement.signature, "");
  assert.equal(result.medicationManagement.signatureDate, "2026-10-11");
});
