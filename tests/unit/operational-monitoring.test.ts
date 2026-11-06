import assert from "node:assert/strict";
import test from "node:test";
import { aggregateOperationalState, classifyBackup, classifyQuota } from "../../src/operations/operationalMonitoring.ts";

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
  assert.equal(classifyQuota(84,100),"Healthy");
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

test("observations require fresh scoped evidence and preserve verified zero", async () => {
  const { normaliseObservation, observationsForEnvironment } = await import("../../src/operations/operationalMonitoring.ts");
  const base = { service: "Synthetic", environment: "TEST" as const, state: "Healthy" as const, sourceType: "authoritative-live" as const, observedAt: iso(1), maxAgeHours: 26, current: 0, limit: 100, limitSource: "provider-retrieved" as const };
  const good = normaliseObservation("zero", base, now);
  assert.equal(good.state, "Healthy");
  assert.equal(good.current, 0);
  assert.equal(good.limitSource, "provider-retrieved");
  for (const patch of [{environment: undefined}, {observedAt: null}, {observedAt: "invalid"}, {observedAt: iso(-1)}, {maxAgeHours: undefined}, {sourceType: "unavailable" as const}]) {
    assert.equal(normaliseObservation("bad", {...base, ...patch}, now).state, "Unknown");
  }
  const stale = normaliseObservation("stale", {...base, observedAt: iso(27)}, now);
  assert.equal(stale.state, "Unavailable");
  assert.equal(stale.evidence, "stale");
  assert.equal(normaliseObservation("failed", {...base, evidence: "failed"}, now).state, "Unavailable");
  assert.equal(normaliseObservation("missing", {...base, evidence: "unsupported"}, now).state, "Unknown");
  assert.equal(normaliseObservation("failure", {...base, state: "Critical", observedAt: iso(27)}, now).state, "Critical");
  assert.equal(normaliseObservation("legacy", {...base, limitSource: undefined}, now).limitSource, "unknown");
  assert.equal(normaliseObservation("invalid", {...base, current: NaN, limit: -1}, now).current, null);
  const prod = normaliseObservation("prod", {...base, environment: "PRODUCTION"}, now);
  const unknown = normaliseObservation("unknown", {...base, environment: undefined}, now);
  assert.deepEqual(observationsForEnvironment([good, prod, unknown], "test").map(x => x.id), ["zero", "unknown"]);
  assert.deepEqual(observationsForEnvironment([good, prod], "production").map(x => x.id), ["prod"]);
  assert.deepEqual(observationsForEnvironment([good, prod], "local"), []);
  assert.equal(classifyQuota(-1, 100), "Unknown");
});
