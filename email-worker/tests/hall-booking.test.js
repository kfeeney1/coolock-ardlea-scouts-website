import test from "node:test";
import assert from "node:assert/strict";
import { cleanHallBooking, occupiedHallDays, saveHallBooking } from "../src/hallBookingModel.js";
import { handleHallBookingRoute } from "../src/hallBookingRoutes.js";
import { encodeHallValue, decodeHallValue, hallFirestore } from "../src/hallFirestore.js";
const sample = (changes = {}) => ({id: "one", resourceId: "group-hall", kind: "external", state: "confirmed", title: "Private hire", hirerName: "Private Person", contact: "private@example.com", notes: "Private notes", interval: {date: "2026-10-29", startTime: "19:00", endDate: "2026-10-29", endTime: "20:00"}, ...changes});
function memoryStore() {
  const records = new Map([["hall/group", {ready: true, revision: 0}], ["siteSettings/hallHire", {enabled: true}], ["adminUsers/council", {active: true, role: "leader", sections: ["Cubs"]}], ["organisationLeadership/council", {active: true, scoutingRole: "Section Leader"}]]);
  return {records, async transaction(work) {
    const changes = [];
    const result = await work({read: async paths => paths.map(path => records.get(path) ?? null), set: (path, value) => changes.push([path, value]), create: (path, value) => {assert.equal(records.has(path), false); changes.push([path, value]);}});
    changes.forEach(([path, value]) => records.set(path, structuredClone(value))); return result;
  }};
}
const save = (store, booking, expectedRevision = 0) => saveHallBooking(store, "council", {booking, expectedRevision}, Date.parse("2026-10-29T12:00Z"));

test("booking lifecycle atomically updates restricted occupancy and two audit representations", async () => {
  const store = memoryStore();
  assert.deepEqual(await save(store, sample()), {id: "one", revision: 1});
  const publicSlot = store.records.get("hallAvailability/2026-10-29");
  assert.deepEqual(publicSlot, {occupied: [{start: "2026-10-29T19:00:00.000Z", end: "2026-10-29T20:00:00.000Z"}]});
  assert.equal(store.records.get("hall/group/bookings/one/history/1").actorUid, "council");
  assert.equal(store.records.get("auditLog/hall-one-1").category, "system");
  await save(store, sample({state: "cancelled"}), 1);
  assert.deepEqual(store.records.get("hallAvailability/2026-10-29"), {occupied: []});
  assert.equal(store.records.get("hall/group/bookings/one/history/2").previous.state, "confirmed");
});
test("conflicting changes and stale writes leave booking, availability, lock and audit unchanged", async () => {
  const store = memoryStore(); await save(store, sample());
  const before = structuredClone([...store.records]);
  await assert.rejects(save(store, sample({id: "two", kind: "blocked"})), {code: "hall/conflict"});
  await assert.rejects(save(store, sample({notes: "Changed"})), {code: "hall/stale"});
  assert.deepEqual([...store.records], before);
  await save(store, sample({id: "adjacent", interval: {...sample().interval, startTime: "20:00", endTime: "21:00"}}));
  assert.equal(store.records.get("hallAvailability/2026-10-29").occupied.length, 2);
});
test("recurrence conflicts, rescheduling, exceptions and draft release update every affected date", async () => {
  const store = memoryStore(), series = sample({recurrence: {frequency: "weekly", until: "2026-11-12"}});
  await save(store, series);
  await assert.rejects(save(store, sample({id: "two", interval: {...sample().interval, date: "2026-11-05", endDate: "2026-11-05"}})), {code: "hall/conflict"});
  await save(store, {...series, exceptions: [{date: "2026-11-05", action: "cancel"}, {date: "2026-11-12", action: "replace", interval: {...sample().interval, date: "2026-11-13", endDate: "2026-11-13"}}]}, 1);
  for (const date of ["2026-11-05", "2026-11-12"]) assert.deepEqual(store.records.get(`hallAvailability/${date}`).occupied, []);
  assert.equal(store.records.get("hallAvailability/2026-11-13").occupied.length, 1);
  await save(store, {...series, state: "draft"}, 2);
  for (const date of ["2026-10-29", "2026-11-13"]) assert.deepEqual(store.records.get(`hallAvailability/${date}`).occupied, []);
});
test("overnight slots split at Dublin midnight across DST without disclosing IDs", async () => {
  const store = memoryStore(); await save(store, sample({interval: {date: "2026-03-28", startTime: "23:00", endDate: "2026-03-29", endTime: "03:00"}}));
  assert.deepEqual(store.records.get("hallAvailability/2026-03-28"), {occupied: [{start: "2026-03-28T23:00:00.000Z", end: "2026-03-29T00:00:00.000Z"}]});
  assert.deepEqual(store.records.get("hallAvailability/2026-03-29"), {occupied: [{start: "2026-03-29T00:00:00.000Z", end: "2026-03-29T02:00:00.000Z"}]});
  assert.equal(occupiedHallDays(sample({interval: {date: "2099-12-31", startTime: "20:00", endDate: "2099-12-31", endTime: "21:00"}})).size, 1);
});
test("Council scope, readiness and source ownership cannot be bypassed", async () => {
  for (const [path, value, code] of [["organisationLeadership/council", {active: true, scoutingRole: "Programme Scouter"}, "hall/forbidden"], ["siteSettings/hallHire", {enabled: false}, "hall/disabled"], ["hall/group", {ready: false}, "hall/disabled"], ["hall/group/bookings/one", {...sample(), source: {collection: "events", id: "event"}, revision: 0}, "hall/source-owned"]]) {
    const store = memoryStore(); store.records.set(path, value); const before = structuredClone([...store.records]);
    await assert.rejects(save(store, sample()), {code}); assert.deepEqual([...store.records], before);
  }
});
test("untrusted fields, invalid recurrence, metadata injection and excessive writes fail closed", async () => {
  for (const value of [sample({source: {collection: "events", id: "private"}}), sample({updatedBy: "admin"}), sample({interval: {...sample().interval, startTime: "24:00"}}), sample({recurrence: {frequency: "daily", until: "2026-11-12"}}), sample({notes: "x".repeat(3001)})]) assert.throws(() => cleanHallBooking(value), {code: "hall/invalid"});
  const store = memoryStore(); const before = structuredClone([...store.records]);
  await assert.rejects(save(store, sample({interval: {...sample().interval, endDate: "2026-11-05", endTime: "19:00"}, recurrence: {frequency: "weekly", until: "2027-10-29"}})), {code: "hall/bounds"});
  assert.deepEqual([...store.records], before);
});
test("wire codec preserves values and refuses unsafe production emulator targets", () => {
  const value = {a: "private", b: true, c: [1, 2.5, null], d: {x: "date"}};
  assert.deepEqual(decodeHallValue(encodeHallValue(value)), value);
  assert.throws(() => hallFirestore({FIREBASE_PROJECT_ID: "coolock-ardlea-scouts", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080"}, "owner"), {code: "hall/configuration"});
});
test("endpoint rejects unauthenticated, forged and cross-origin requests before any reservation", async () => {
  const env = {FIREBASE_PROJECT_ID: "demo-coolock-ardlea-scouts", ALLOWED_ORIGINS: "https://test.example"};
  const request = (authorization = "", origin = "https://test.example") => new Request("https://worker.example/hall-bookings", {method: "POST", headers: {Origin: origin, Authorization: authorization}, body: JSON.stringify({action: "save", command: {booking: sample(), expectedRevision: 0}})});
  let calls = 0;
  const deny = async () => {calls++; return new Response("{}", {status: 403});};
  assert.equal((await handleHallBookingRoute(request(), env, async () => "service", deny)).status, 401);
  const fake = `x.${btoa(JSON.stringify({sub: "council"}))}.fake`;
  assert.equal((await handleHallBookingRoute(request(`Bearer ${fake}`), env, async () => "service", deny)).status, 403);
  assert.equal(calls, 1);
  assert.equal((await handleHallBookingRoute(request(`Bearer ${fake}`, "https://evil.example"), env, async () => "service", deny)).status, 403);
  assert.equal(calls, 1);
});
