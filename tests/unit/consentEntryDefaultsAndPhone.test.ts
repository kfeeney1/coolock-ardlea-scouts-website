import test from "node:test";
import assert from "node:assert/strict";
import { medicationAuthorisationDefaults } from "../../src/services/medicationAuthorisationDates.ts";
import { sanitizePhoneInput, isValidPhone } from "../../src/services/phoneInput.ts";
test("SW-300/SW-302 local defaults use today and 31 August next year", () => {
 assert.deepEqual(medicationAuthorisationDefaults(new Date(2026,9,5,23,59)),{authFrom:"2026-10-05",authTo:"2027-08-31"});
 assert.deepEqual(medicationAuthorisationDefaults(new Date(2028,1,29,0,1)),{authFrom:"2028-02-29",authTo:"2029-08-31"});
});
test("SW-306 phone input preserves identifiers and removes invalid characters", () => {
 assert.equal(sanitizePhoneInput("087 123 4567abc"),"087 123 4567");
 assert.equal(sanitizePhoneInput("+353 (87) 123-4567"),"+353 (87) 123-4567");
 assert.equal(isValidPhone("0871234567"),true); assert.equal(isValidPhone("+353 87 123 4567"),true); assert.equal(isValidPhone("abc"),false);
});
