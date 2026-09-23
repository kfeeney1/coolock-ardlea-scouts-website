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
