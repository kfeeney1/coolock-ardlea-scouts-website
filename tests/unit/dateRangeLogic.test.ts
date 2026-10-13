import test from "node:test";
import assert from "node:assert/strict";
import { dateRangeError, formatDateRangeInput, isIsoCalendarDate, isValidDateRange, parseDateRangeInput } from "../../src/services/dateRangeLogic.ts";

test("date-only ranges require a valid start before an end and reject reversed or malformed dates", () => {
  assert.equal(dateRangeError("", "2026-10-01"), "Enter a valid start date before selecting an end date.");
  assert.equal(dateRangeError("2026-10-02", "2026-10-01"), "End date must be on or after the start date.");
  assert.equal(isValidDateRange("2026-10-02", "2026-10-01"), false);
  assert.equal(isValidDateRange("2026-10-01", "2026-10-01"), true);
  assert.equal(isValidDateRange("2026-12-31", "2027-01-01"), true);
  assert.equal(dateRangeError("2026-02-30", "2026-03-01"), "Enter a valid start date before selecting an end date.");
  assert.equal(dateRangeError("2026-10-01", "2026-02-30"), "Enter a valid end date.");
  assert.equal(isValidDateRange("2026-10-01", "2026-02-30"), false);
  assert.equal(isValidDateRange("", "", { requireStart: true, requireEnd: true }), false);
});

test("ISO date validation uses calendar dates rather than UTC timestamp comparisons", () => {
  assert.equal(isIsoCalendarDate("2024-02-29"), true);
  assert.equal(isIsoCalendarDate("2025-02-29"), false);
  assert.equal(isIsoCalendarDate("2026-13-01"), false);
  assert.equal(isIsoCalendarDate("2026-01-00"), false);
});

test("date range text accepts ISO and site-formatted dates without timezone conversion", () => {
  assert.equal(parseDateRangeInput("2026-10-18"), "2026-10-18");
  assert.equal(parseDateRangeInput("18-10-2026"), "2026-10-18");
  assert.equal(parseDateRangeInput("18/10/2026"), "2026-10-18");
  assert.equal(parseDateRangeInput("31-02-2026"), null);
  assert.equal(parseDateRangeInput("2026-02-30"), null);
  assert.equal(formatDateRangeInput("2026-10-18"), "18-10-2026");
  assert.equal(formatDateRangeInput("2026-02-30"), "2026-02-30");
});
