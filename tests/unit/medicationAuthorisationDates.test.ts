import test from "node:test";
import assert from "node:assert/strict";

import { createMedicationEntry, createNewMedicationEntry, medicationAuthorisationDefaults, medicationEntries } from "../../src/components/consent/MedicationManagementForm.tsx";

test("SW-262 defaults authorised from to the controlled local calendar date", () => {
    assert.deepEqual(medicationAuthorisationDefaults(new Date(2026, 9, 2, 12)), {
        authFrom: "2026-10-02",
        authTo: "2027-08-31"
    });
});

test("SW-262 always uses 31 August of the following calendar year at boundaries", () => {
    const cases = [
        [new Date(2026, 7, 31, 12), "2026-08-31", "2027-08-31"],
        [new Date(2026, 8, 1, 12), "2026-09-01", "2027-08-31"],
        [new Date(2026, 11, 31, 12), "2026-12-31", "2027-08-31"],
        [new Date(2028, 1, 29, 12), "2028-02-29", "2029-08-31"]
    ] as const;
    for (const [now, authFrom, authTo] of cases) {
        assert.deepEqual(medicationAuthorisationDefaults(now), { authFrom, authTo });
    }
});

test("SW-262 creates each new medication with fresh controlled defaults", () => {
    assert.deepEqual(createNewMedicationEntry(new Date(2026, 0, 15, 12)), {
        medicineName: "", dosage: "", frequency: "", quantitySupplied: "", method: "", otherInfo: "", selfAdmin: "",
        authFrom: "2026-01-15", authTo: "2027-08-31"
    });
    assert.deepEqual(createNewMedicationEntry(new Date(2026, 8, 1, 12)).authTo, "2027-08-31");
});

test("existing and user-edited medication dates are preserved", () => {
    const edited = createMedicationEntry("2026-10-10", "2027-07-20");
    const entries = medicationEntries({
        enabled: true, medications: [edited], memberName: "", dateOfBirth: "", address: "",
        medicineName: "", dosage: "", frequency: "", quantitySupplied: "", doctorName: "", doctorTel: "",
        pharmacyName: "", pharmacyTel: "", method: "", otherInfo: "", selfAdmin: "", authFrom: edited.authFrom,
        authTo: edited.authTo, scouter1: "", scouter2: "", signature: "", signatureDate: ""
    });
    assert.equal(entries[0].authFrom, "2026-10-10");
    assert.equal(entries[0].authTo, "2027-07-20");
});
