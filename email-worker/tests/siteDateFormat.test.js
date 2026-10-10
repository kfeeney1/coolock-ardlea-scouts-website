import assert from "node:assert/strict";
import test from "node:test";
import { formatSiteDate } from "../src/siteDateFormat.js";

test("formats email date-only values without timezone shifts", () => {
  assert.equal(formatSiteDate("2026-10-04"), "04-10-2026");
});

test("formats email timestamps in the Scout group's timezone", () => {
  assert.equal(formatSiteDate("2026-10-03T23:30:00Z"), "04-10-2026");
});
