import assert from "node:assert/strict";
import test from "node:test";
import { aggregateOperationalState, classifyBackup, classifyQuota, evaluateObservation, normaliseObservation, type OperationalObservation } from "../../src/operations/operationalMonitoring.ts";

const now=Date.parse("2026-09-23T12:00:00Z");
const iso=(hours:number)=>new Date(now-hours*3600000).toISOString();

test("backup freshness is fail closed across boundaries",()=>{
  assert.equal(classifyBackup({observedAt:iso(1),latestSuccessAt:iso(1),lastAttemptOutcome:"success"},now),"Healthy");
  assert.equal(classifyBackup({observedAt:iso(1),latestSuccessAt:iso(169),lastAttemptOutcome:"success"},now),"Warning");
  assert.equal(classifyBackup({observedAt:iso(1),latestSuccessAt:iso(193),lastAttemptOutcome:"success"},now),"Critical");
  assert.equal(classifyBackup({observedAt:iso(1),latestSuccessAt:null},now),"Missing");
  assert.equal(classifyBackup({observedAt:null,latestSuccessAt:iso(1)},now),"Unknown");
  assert.equal(classifyBackup({observedAt:iso(27),latestSuccessAt:iso(1)},now),"Unavailable");
  assert.equal(classifyBackup({observedAt:iso(1),latestSuccessAt:iso(1),lastAttemptAt:iso(0.5),lastAttemptOutcome:"failed"},now),"Critical");
  assert.equal(classifyBackup({observedAt:new Date(now+3600000).toISOString(),latestSuccessAt:iso(1)},now),"Unknown");
  assert.equal(classifyBackup({observedAt:iso(1),latestSuccessAt:"bad"},now),"Unknown");
});

test("quota thresholds handle unknown and invalid limits",()=>{
  assert.equal(classifyQuota(84,100),"Notice");
  assert.equal(classifyQuota(85,100),"Warning");
  assert.equal(classifyQuota(95,100),"Critical");
  assert.equal(classifyQuota(0,0),"Unknown");
  assert.equal(classifyQuota(null,100),"Unknown");
  assert.equal(classifyQuota(10,null),"Unknown");
});

test("overall state cannot hide critical or unknown monitoring",()=>{
  assert.equal(aggregateOperationalState(["Healthy","Critical"]),"Critical");
  assert.equal(aggregateOperationalState(["Healthy","Warning"]),"Warning");
  assert.equal(aggregateOperationalState(["Healthy","Unavailable"]),"Unknown");
  assert.equal(aggregateOperationalState([]),"Unknown");
});

const sample: OperationalObservation = {
  id: "synthetic", service: "Synthetic provider", environment: "TEST", metric: "daily sends",
  state: "Healthy", source: "Synthetic fixture", sourceType: "authoritative-live",
  observedAt: iso(1), maxAgeHours: 26, current: 0, limit: 100, limitSource: "provider-retrieved"
};

test("verified zero differs from missing usage and unverified limits", () => {
  assert.equal(evaluateObservation(sample, "TEST", now).current, 0);
  assert.equal(evaluateObservation(sample, "TEST", now).state, "Healthy");
  for (const current of [null, NaN, -1, Infinity]) assert.notEqual(evaluateObservation({ ...sample, current }, "TEST", now).state, "Healthy");
  assert.equal(evaluateObservation({ ...sample, limitSource: "unknown" }, "TEST", now).state, "Unknown");
  assert.equal(evaluateObservation({ ...sample, limitSource: "configured-reference", current: 85 }, "TEST", now).state, "Warning");
  assert.equal(classifyQuota(69, 100), "Healthy");
  assert.equal(classifyQuota(70, 100), "Notice");
  assert.equal(classifyQuota(100, 100), "Exhausted");
  assert.equal(classifyQuota(-1, 100), "Unknown");
  assert.equal(classifyQuota(0, 100, 0.95, 0.85), "Unknown");
});

test("missing, invalid, future and stale evidence cannot retain stored Healthy", () => {
  for (const observedAt of [null, "invalid", iso(-1), iso(27)]) {
    assert.equal(evaluateObservation({ ...sample, observedAt }, "TEST", now).state, "Unavailable");
  }
  assert.equal(evaluateObservation({ ...sample, maxAgeHours: null }, "TEST", now).evidence, "unknown");
  for (const evidence of ["failed", "unsupported", "unconfigured"] as const) {
    assert.equal(evaluateObservation({ ...sample, evidence }, "TEST", now).evidence, evidence);
    assert.equal(evaluateObservation({ ...sample, evidence }, "TEST", now).state, "Unavailable");
  }
  assert.equal(evaluateObservation({ ...sample, state: "Critical" }, "TEST", now).state, "Critical");
});

test("environment mismatch and absent environment never become production evidence", () => {
  assert.equal(evaluateObservation(sample, "PRODUCTION", now).state, "Unavailable");
  const row = normaliseObservation("bad", { ...sample, environment: undefined });
  assert.equal(row.environment, "Unknown");
  assert.equal(evaluateObservation(row, "PRODUCTION", now).state, "Unavailable");
  assert.equal(evaluateObservation({ ...sample, environment: "BOTH" }, "TEST", now).state, "Healthy");
});

test("backup age advances without another provider request", () => {
  const backup: OperationalObservation = { ...sample, id: "firestore-backup-production", environment: "PRODUCTION", limit: null, current: 168 };
  assert.equal(evaluateObservation(backup, "PRODUCTION", now).state, "Warning");
  assert.equal(evaluateObservation({ ...backup, current: 192 }, "PRODUCTION", now).state, "Critical");
  assert.equal(evaluateObservation({ ...backup, current: null }, "PRODUCTION", now).state, "Unavailable");
});

test("normalisation drops invalid numbers and arbitrary management destinations", () => {
  const row = normaliseObservation("unsafe", { ...sample, current: NaN, limit: Infinity, managementUrl: "https://attacker.test/?secret=value" });
  assert.equal(row.current, null);
  assert.equal(row.limit, null);
  assert.equal(row.managementUrl, undefined);
  assert.equal(aggregateOperationalState(["Healthy", "Unknown"]), "Unknown");
  assert.equal(aggregateOperationalState(["Notice", "Unavailable"]), "Unknown");
  assert.equal(aggregateOperationalState(["Exhausted", "Healthy"]), "Exhausted");
});
