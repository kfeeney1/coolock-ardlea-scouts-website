import assert from "node:assert/strict";
import test from "node:test";

import { buildScoutPeriods, findScoutPeriod, scoutYearStartYear } from "../../src/services/scoutPeriods.ts";

test("Scout year starts in September", () => {
  assert.equal(scoutYearStartYear(new Date("2026-08-27T12:00:00Z")), 2025);
  assert.equal(scoutYearStartYear(new Date("2026-09-01T12:00:00Z")), 2026);
});

test("buildScoutPeriods creates stable Scout year and term boundaries", () => {
  const periods = buildScoutPeriods(new Date("2026-10-10T12:00:00Z"));
  assert.deepEqual(periods, [
    { id: "scout-year", label: "2026/27 Scout Year", from: "2026-09-01", to: "2027-08-31" },
    { id: "autumn", label: "Autumn Term", from: "2026-09-01", to: "2026-12-31" },
    { id: "spring", label: "Spring Term", from: "2027-01-01", to: "2027-03-31" },
    { id: "summer", label: "Summer Term", from: "2027-04-01", to: "2027-08-31" }
  ]);
});

test("findScoutPeriod returns the requested period", () => {
  assert.deepEqual(findScoutPeriod("spring", new Date("2026-10-10T12:00:00Z")), {
    id: "spring",
    label: "Spring Term",
    from: "2027-01-01",
    to: "2027-03-31"
  });
  assert.equal(findScoutPeriod("unknown", new Date("2026-10-10T12:00:00Z")), null);
});
