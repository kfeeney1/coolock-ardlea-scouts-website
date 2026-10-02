import test from "node:test";
import assert from "node:assert/strict";

import { medicationAuthorisationDefaults } from "../../src/services/medicationAuthorisationDates.ts";

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

