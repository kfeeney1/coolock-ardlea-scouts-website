import assert from "node:assert/strict";
import test from "node:test";
import { matchApprovedEvent } from "../scripts/lookup-six-test-events.mjs";

test("matches all six owner-approved event title/date pairs", () => {
  const entries = [
    ["Cub County weekend", "2026-09-18", "2026-09-20"],
    ["Test", "2026-09-22", "2026-09-23"],
    ["Test", "2026-10-02", "2026-10-02"],
    ["Test123", "2026-10-10", "2026-10-10"],
    ["Twst12", "2026-10-15", "2026-10-15"],
    ["Event123", "2056-10-12", "2056-10-12"],
  ];
  entries.forEach(([title, startDate, endDate], index) => {
    assert.equal(matchApprovedEvent({ title, startDate, endDate }), index);
  });
});
test("accepts display-style day-month-year date strings", () => {
  assert.equal(matchApprovedEvent({ title: "Test", startDate: "22-09-2026", endDate: "23-09-2026" }), 1);
});
test("rejects near misses and unrelated events", () => {
  assert.equal(matchApprovedEvent({ title: "Test", startDate: "2026-10-03" }), -1);
  assert.equal(matchApprovedEvent({ title: "Cub County weekend", startDate: "2026-09-18", endDate: "2026-09-21" }), -1);
  assert.equal(matchApprovedEvent({ title: "Test123", startDate: "2026-10-10", endDate: "2026-10-11" }), -1);
  assert.equal(matchApprovedEvent({ title: "Real event", startDate: "2026-10-10" }), -1);
});
