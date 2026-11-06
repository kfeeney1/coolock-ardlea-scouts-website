import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { backupMonitoringPayload } from "../../scripts/backup-monitoring-payload.mjs";

const observedAt = "2026-11-06T12:00:00Z";
test("backup publication distinguishes verified zero, unavailable inspection and missing backup", () => {
  const fresh = backupMonitoringPayload({kind: "freshness", state: "Healthy", age: 0, observedAt}).fields;
  assert.deepEqual(fresh.current, {integerValue: "0"});
  assert.deepEqual(fresh.maxAgeHours, {integerValue: "26"});
  for (const state of [undefined, "Unavailable", "Missing", "Healthy"]) {
    const fields = backupMonitoringPayload({kind: "freshness", state, observedAt}).fields;
    assert.equal(fields.current, undefined);
    assert.notEqual(fields.state.stringValue, "Healthy");
  }
  for (const age of [-1, NaN, Infinity]) {
    assert.equal(backupMonitoringPayload({kind: "freshness", state: "Healthy", age, observedAt}).fields.state.stringValue, "Unavailable");
  }
  assert.equal(backupMonitoringPayload({kind: "freshness", state: "Critical", age: 193, observedAt}).fields.state.stringValue, "Critical");
  const execution = backupMonitoringPayload({kind: "execution", state: "Critical", observedAt}).fields;
  assert.equal(execution.state.stringValue, "Critical");
  assert.equal(execution.current, undefined);
  assert.equal(execution.environment.stringValue, "PRODUCTION");
  assert.throws(() => backupMonitoringPayload({kind: "invalid", observedAt}));
  assert.throws(() => backupMonitoringPayload({kind: "freshness", observedAt: "bad"}));
});

test("existing backup workflows publish shared payloads without fabricating age or changing cadence", () => {
  const freshness = readFileSync(".github/workflows/firestore-backup-freshness.yml", "utf8");
  const execution = readFileSync(".github/workflows/firestore-backup.yml", "utf8");
  for (const workflow of [freshness, execution]) {
    assert.match(workflow, /node scripts\/backup-monitoring-payload.mjs/);
    assert.match(workflow, /if: always\(\)/);
    assert.match(workflow, /readback/);
    assert.match(workflow, /PROJECT_ID: coolock-ardlea-scouts/);
  }
  assert.match(freshness, /cron: "47 5 \* \* \*"/);
  assert.match(freshness, /if ! LISTING=/);
  assert.match(freshness, /state=Unavailable/);
  assert.match(freshness, /state=Missing/);
  assert.doesNotMatch(freshness, /then "0"/);
});
