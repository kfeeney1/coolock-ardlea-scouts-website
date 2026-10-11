import assert from "node:assert/strict";
import test from "node:test";

import { leaderMedicalDefaultsFromOwnRecords } from "../../src/services/leaderMedicalProfileLogic.ts";

test("leader medical defaults use current admin profile, then the UID-linked member, then own registration", () => {
  const defaults = leaderMedicalDefaultsFromOwnRecords(
    { displayName: "Current Name", mobileNumber: "", address: "Current Address", homePhone: "012345678" },
    { displayName: "Member Name", dateOfBirth: "1985-04-12", mobileNumber: "0871111111" },
    { fullName: "Registration Name", mobileNumber: "0861234567" },
    "Auth Name"
  );
  assert.deepEqual(defaults, {
    name: "Current Name", dob: "1985-04-12", address: "Current Address", mobile: "0871111111",
    homePhone: "012345678", workPhone: ""
  });
  assert.equal(defaults.dob, "1985-04-12", "date-only profile values retain the same calendar day");
});

test("registration contact is a safe mobile fallback when approval omitted it from adminUsers", () => {
  const defaults = leaderMedicalDefaultsFromOwnRecords(
    { active: true, displayName: "Approved Scouter" }, null,
    { uid: "signed-in-uid", fullName: "Registration Name", mobileNumber: "0861234567" }, "Auth Name"
  );
  assert.equal(defaults.name, "Approved Scouter");
  assert.equal(defaults.mobile, "0861234567");
});

test("ambiguous duplicate member records are not selected as defaults", () => {
  const defaults = leaderMedicalDefaultsFromOwnRecords(
    { displayName: "Signed-in Profile", mobileNumber: "0872222222" }, null,
    { fullName: "Other Name", mobileNumber: "0869999999" }, "Auth Name"
  );
  assert.equal(defaults.name, "Signed-in Profile");
  assert.equal(defaults.mobile, "0872222222");
});
