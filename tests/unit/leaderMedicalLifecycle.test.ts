import assert from "node:assert/strict";
import test from "node:test";

import { daysBetweenLocalDates, leaderMedicalNeedsDashboardAction, leaderMedicalStateFromRecords, leaderMedicalValidityEnd } from "../../src/services/leaderMedicalLifecycle.ts";

test("leader medical validity uses Scout-year 31 August boundary without late-August near-expiry", () => {
  assert.equal(leaderMedicalValidityEnd("2026-06-30"), "2026-08-31");
  assert.equal(leaderMedicalValidityEnd("2026-07-01"), "2027-08-31");
  assert.equal(leaderMedicalValidityEnd("2026-08-30"), "2027-08-31");
  assert.equal(leaderMedicalValidityEnd("2026-08-31"), "2027-08-31");
  assert.equal(leaderMedicalValidityEnd("2026-09-01"), "2027-08-31");
  assert.equal(leaderMedicalValidityEnd("2028-02-29"), "2028-08-31");
});

test("leader medical status is shared across missing, current, renewal and lapsed states", () => {
  assert.equal(leaderMedicalStateFromRecords([], "2026-07-01").status, "missing");
  const records = [{ id: "form-1", data: { declarationConfirmed: true, signature: "Leader", validityFrom: "2025-09-01", validityTo: "2026-08-31" } }];
  assert.equal(leaderMedicalStateFromRecords(records, "2026-07-01").status, "current");
  assert.equal(leaderMedicalStateFromRecords(records, "2026-08-01").status, "approaching-expiry");
  assert.equal(leaderMedicalStateFromRecords(records, "2026-08-31").status, "approaching-expiry");
  assert.equal(leaderMedicalStateFromRecords(records, "2026-09-01").status, "lapsed");
  assert.equal(leaderMedicalNeedsDashboardAction("lapsed"), true);
  assert.equal(leaderMedicalNeedsDashboardAction("current"), false);
});

test("newer renewal record becomes authoritative without deleting history", () => {
  const state = leaderMedicalStateFromRecords([
    { id: "old", data: { declarationConfirmed: true, signature: "Leader", validityFrom: "2025-09-01", validityTo: "2026-08-31" } },
    { id: "renewal", data: { declarationConfirmed: true, signature: "Leader", validityFrom: "2026-08-10", validityTo: "2027-08-31" } }
  ], "2026-08-20");
  assert.equal(state.formId, "renewal");
  assert.equal(state.status, "current");
  assert.equal(state.validityTo, "2027-08-31");
});

test("local date arithmetic is stable across year and leap-year boundaries", () => {
  assert.equal(daysBetweenLocalDates("2026-08-31", "2026-09-01"), 1);
  assert.equal(daysBetweenLocalDates("2028-02-28", "2028-03-01"), 2);
});
