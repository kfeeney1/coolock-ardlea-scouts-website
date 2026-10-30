import test from "node:test";
import assert from "node:assert/strict";
import {saveHallEventSource} from "../src/hallEventSource.js";
import {hallSourceIdentity} from "../src/hallSourceReservation.js";
import {saveHallBooking} from "../src/hallBookingModel.js";
const id = "event-source-001", uid = "council", now = Date.parse("2026-10-30T12:00Z");
const date = "2026-11-05";
const source = {section: "Cubs", startDate: date, endDate: "2026-11-07", status: "open", title: "PRIVATE event", leaderNotes: "PRIVATE notes", audience: {memberIds: ["PRIVATE member"]}, attendance: {private: "attending"}, consent: {private: "received"}, createdBy: "original", createdAt: "2026-10-01T12:00:00Z"};
function store() {
  const records = new Map([["hall/group", {ready: true, revision: 0}], ["siteSettings/hallHire", {enabled: true}], [`adminUsers/${uid}`, {active: true, role: "leader", sections: ["Cubs"]}], [`organisationLeadership/${uid}`, {active: true, scoutingRole: "Section Leader"}], [`events/${id}`, structuredClone(source)]]);
  return {records, async transaction(work) {const writes = []; const result = await work({read: async paths => paths.map(path => records.get(path) ?? null), set: (path, value) => writes.push([path, value]), patch: (path, value, removed = []) => {const next = {...records.get(path), ...value}; removed.forEach(key => delete next[key]); writes.push([path, next]);}, create: (path, value) => {assert.equal(records.has(path), false); writes.push([path, value]);}}); writes.forEach(([path, value]) => records.set(path, structuredClone(value))); return result;}};
}

const interval = {date, startTime: "19:00", endDate: date, endTime: "20:00"};
const save = (db, changes = {}) => saveHallEventSource(db, uid, {id, expectedRevision: 0, expectedStartDate: source.startDate, expectedEndDate: source.endDate, interval, ...changes}, now);
const release = (db, revision = 1) => saveHallEventSource(db, uid, {id, expectedRevision: revision, expectedStartDate: source.startDate, expectedEndDate: source.endDate, release: true}, now);
test("reserve/move/release preserve all programme and audience fields and publish only neutral ranges", async () => {
  const db = store(); assert.deepEqual(await save(db), {id, revision: 1});
  for (const key of Object.keys(source)) assert.deepEqual(db.records.get(`events/${id}`)[key], source[key]);
  const {bookingId} = await hallSourceIdentity("event", id);
  assert.equal(JSON.stringify(db.records.get(`hall/group/bookings/${bookingId}`)).includes("PRIVATE"), false);
  assert.deepEqual(Object.keys(db.records.get(`hallAvailability/${date}`)), ["occupied"]);
  await save(db, {expectedRevision: 1, interval: {...interval, date: "2026-11-06", endDate: "2026-11-06"}});
  assert.deepEqual(db.records.get(`hallAvailability/${date}`), {occupied: []});
  await release(db, 2); assert.equal(db.records.get(`events/${id}`).hallResource, undefined);
  assert.equal(db.records.get(`events/${id}`).hallInterval, undefined);
  assert.deepEqual(db.records.get("hallAvailability/2026-11-06"), {occupied: []});
});
test("Council does not grant event write scope; inactive/revoked leaders cannot write", async () => {
  for (const profile of [{active: false, role: "leader", sections: ["Cubs"]}, {active: true, role: "leader", sections: ["Scouts"]}]) {
    const db = store(); db.records.set(`adminUsers/${uid}`, profile); await assert.rejects(save(db), {status: 403});
  }
  const db = store(); db.records.set(`organisationLeadership/${uid}`, {active: true, scoutingRole: "Scouter"}); await assert.rejects(save(db), {status: 403});
  db.records.set(`organisationLeadership/${uid}`, {active: true, scoutingRole: "Group Leader"}); db.records.set(`adminUsers/${uid}`, {active: true, role: "leader", sections: ["Group"]}); await assert.rejects(save(db), {status: 403});
  db.records.delete(`events/${id}`); await assert.rejects(save(db), {status: 403});
});
test("source date and hall revision races fail atomically", async () => {
  const db = store(); await save(db); const before = structuredClone([...db.records]); await assert.rejects(save(db), {code: "hall/stale"}); assert.deepEqual([...db.records], before);
  await assert.rejects(save(db, {expectedRevision: 1, expectedEndDate: date}), {code: "hall/stale"});
});
test("new reservations need rollout; existing changes/release work off and completed events retain explicit occupancy", async () => {
  const db = store(); db.records.set("siteSettings/hallHire", {enabled: false}); await assert.rejects(save(db), {code: "hall/disabled"});
  db.records.set("siteSettings/hallHire", {enabled: true}); await save(db); db.records.set("siteSettings/hallHire", {enabled: false});
  await save(db, {expectedRevision: 1, interval: {...interval, endTime: "21:00"}});
  db.records.set(`events/${id}`, {...db.records.get(`events/${id}`), status: "completed"}); await assert.rejects(save(db, {expectedRevision: 2}), {code: "hall/closed"}); await release(db, 2);
  assert.equal(db.records.get(`events/${id}`).status, "completed");
});
test("hall interval is bounded inside source dates; private injection, DST gaps/folds and unlimited spans reject", async () => {
  for (const command of [{interval: {...interval, date: "2026-11-04"}}, {interval: {...interval, endDate: "2026-11-08"}}, {interval: {...interval, notes: "PRIVATE"}}, {leaderNotes: "PRIVATE"}, {interval: {...interval, startTime: "20:00"}}]) await assert.rejects(save(store(), command), {code: "hall/invalid"});
  for (const date of ["2026-03-29", "2026-10-25"]) {
    const db = store(); db.records.set(`events/${id}`, {...source, startDate: date, endDate: date});
    await assert.rejects(save(db, {expectedStartDate: date, expectedEndDate: date, interval: {date, endDate: date, startTime: "01:30", endTime: "03:00"}}), {code: "hall/invalid"});
  }
  const db = store(); db.records.set(`events/${id}`, {...source, endDate: "2026-12-01"}); await assert.rejects(save(db, {expectedEndDate: "2026-12-01", interval: {...interval, endDate: "2026-11-13"}}), {code: "hall/invalid"});
});
test("shared recurring/blocked conflicts reject without source writes and adjacent times succeed", async () => {
  const db = store(); await saveHallBooking(db, uid, {expectedRevision: 0, booking: {id: "block", resourceId: "group-hall", kind: "blocked", state: "confirmed", title: "PRIVATE block", hirerName: "", contact: "", notes: "", interval, recurrence: {frequency: "weekly", until: "2026-11-12"}}}, now);
  const before = structuredClone([...db.records]); await assert.rejects(save(db), {code: "hall/conflict"}); assert.deepEqual([...db.records], before);
  await save(db, {interval: {...interval, startTime: "20:00", endTime: "21:00"}}); assert.equal(db.records.get(`hallAvailability/${date}`).occupied.length, 2);
});
