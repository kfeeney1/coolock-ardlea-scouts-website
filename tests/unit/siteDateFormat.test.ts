import assert from "node:assert/strict";
import test from "node:test";

import { formatSiteDate, formatSiteDateText, formatSiteDateTime } from "../../src/services/siteDateFormat.ts";

test("formats date-only values as dd-mm-yyyy without timezone drift", () => {
  assert.equal(formatSiteDate("2026-09-02"), "02-09-2026");
});

test("zero-pads single digit days and months", () => {
  assert.equal(formatSiteDate("2026-01-05"), "05-01-2026");
});

test("leaves invalid string values available for legacy fallbacks", () => {
  assert.equal(formatSiteDate("not-a-date"), "not-a-date");
});

test("date-only values stay on the same calendar day in explicit timezones", () => {
  assert.equal(formatSiteDate("2026-09-23", "Pacific/Auckland"), "23-09-2026");
  assert.equal(formatSiteDate("2026-09-23", "America/Los_Angeles"), "23-09-2026");
});

test("formats timestamp values deterministically with an explicit timezone", () => {
  assert.equal(formatSiteDate("2026-09-23T23:30:00Z", "Europe/Dublin"), "24-09-2026");
});

test("uses the site timezone for timestamp calendar dates regardless of device timezone", () => {
  assert.equal(formatSiteDate(new Date("2026-10-03T23:30:00Z")), "04-10-2026");
  assert.equal(formatSiteDateTime(new Date("2026-10-03T23:30:00Z")), "04-10-2026, 00:30");
});

test("formats date-time values with the fixed site timezone and retains the time", () => {
  assert.equal(formatSiteDateTime(new Date("2026-10-03T16:34:00Z")), "03-10-2026, 17:34");
});

test("date-only presentation is timezone independent and preserves the canonical day", () => {
  for (const timeZone of ["Pacific/Auckland", "America/Los_Angeles", "Europe/Dublin"]) {
    assert.equal(formatSiteDate("2026-09-29", timeZone), "29-09-2026");
  }
});

test("formats ISO dates embedded in activity text while retaining timestamp time", () => {
  assert.equal(formatSiteDateText("Due 2026-09-29; entered 2026-10-03T16:34:00Z"), "Due 29-09-2026; entered 03-10-2026, 17:34");
});
