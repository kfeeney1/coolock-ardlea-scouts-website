import assert from "node:assert/strict";
import test from "node:test";

import { formatSiteDate } from "../../src/services/siteDateFormat.ts";

test("formats date-only values as dd-mm-yyyy without timezone drift", () => {
  assert.equal(formatSiteDate("2026-09-02"), "02-09-2026");
});

test("zero-pads single digit days and months", () => {
  assert.equal(formatSiteDate("2026-01-05"), "05-01-2026");
});

test("leaves invalid string values available for legacy fallbacks", () => {
  assert.equal(formatSiteDate("not-a-date"), "not-a-date");
});
