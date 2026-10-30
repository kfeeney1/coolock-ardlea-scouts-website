import test from "node:test";
import assert from "node:assert/strict";
import { hallSourceIdentity, saveSourceHallReservation } from "../src/hallSourceReservation.js";
import { saveHallBooking } from "../src/hallBookingModel.js";
const interval = {date: "2026-10-29", startTime: "19:00", endDate: "2026-10-29", endTime: "20:00"};
const occupancy = (changes = {}) => ({resourceId: "group-hall", kind: "internal", state: "confirmed", interval, ...changes});
const now = Date.parse("2026-10-29T12:00Z");
function memory() {
  const records = new Map([["hall/group", {ready: false, revision: 0}], ["siteSettings/hallHire", {enabled: false}]]);
  return {records, async transaction(work) {
    const changes = [];
    const result = await work({read: async paths => paths.map(path => structuredClone(records.get(path) ?? null)), set: (path, value) => changes.push([path, value]), create: (path, value) => {assert.equal(records.has(path), false); changes.push([path, value]);}});
    changes.forEach(([path, value]) => records.set(path, structuredClone(value))); return result;
  }};
}
function source(store, kind = "meeting", id = "same", value = occupancy(), extra = {}) {
  return saveSourceHallReservation(store, "writer", kind, id, async (tx, {path, current}) => ({authorised: true, occupancy: value,
    persist: () => tx.set(path, {revision: (current?.revision ?? 0) + 1, privateProgramme: "Never copied", ...extra})}), now);
}
test("source identity is stable, scoped, bounded and rejects path injection", async () => {
  const meeting = await hallSourceIdentity("meeting", "a_b");
  assert.deepEqual(meeting, await hallSourceIdentity("meeting", "a_b"));
  assert.notEqual(meeting.bookingId, (await hallSourceIdentity("event", "a_b")).bookingId);
  assert.notEqual(meeting.bookingId, (await hallSourceIdentity("meeting", "a-b")).bookingId);
  assert.equal(meeting.bookingId.length, 71);
  for (const [kind, id] of [["__proto__", "x"], ["meeting", "../x"], ["meeting", "x".repeat(129)]]) await assert.rejects(hallSourceIdentity(kind, id), {code: "hall/source"});
});
test("source lifecycle and generic audit/public projections commit together while rollout is off", async () => {
  const store = memory(); const first = await source(store);
  const saved = store.records.get(`hall/group/bookings/${first.id}`);
  assert.deepEqual(saved.source, {collection: "weeklyMeetings", id: "same"});
  assert.equal(saved.title, "Source reservation"); assert.equal(saved.notes, "");
  assert.equal(JSON.stringify(saved).includes("Never copied"), false);
  assert.deepEqual(store.records.get("hallAvailability/2026-10-29"), {occupied: [{start: "2026-10-29T19:00:00.000Z", end: "2026-10-29T20:00:00.000Z"}]});
  await source(store, "meeting", "same", occupancy({interval: {...interval, date: "2026-10-30", endDate: "2026-10-30"}}));
  assert.deepEqual(store.records.get("hallAvailability/2026-10-29"), {occupied: []});
  assert.equal(store.records.get("hallAvailability/2026-10-30").occupied.length, 1);
  await source(store, "meeting", "same", null, {cancelled: true});
  assert.deepEqual(store.records.get("hallAvailability/2026-10-30"), {occupied: []});
  assert.equal(store.records.get(`hall/group/bookings/${first.id}`).state, "cancelled");
  assert.equal(store.records.get(`hall/group/bookings/${first.id}/history/3`).previous.state, "confirmed");
  assert.equal(store.records.get("weeklyMeetings/same").revision, 3);
});
test("source conflicts block canonical changes and half-open adjacency remains available", async () => {
  const store = memory(); await source(store);
  const before = structuredClone([...store.records]);
  await assert.rejects(source(store, "event"), {code: "hall/conflict"});
  assert.deepEqual([...store.records], before);
  await source(store, "maintenance", "adjacent", occupancy({kind: "blocked", interval: {...interval, startTime: "20:00", endTime: "21:00"}}));
  assert.equal(store.records.get("hallAvailability/2026-10-29").occupied.length, 2);
});
test("source writes cannot bypass existing manual bookings even when feature is disabled", async () => {
  const store = memory();
  store.records.set("hall/group", {ready: true, revision: 0}); store.records.set("siteSettings/hallHire", {enabled: true});
  store.records.set("adminUsers/writer", {active: true, role: "leader", sections: ["Cubs"]});
  store.records.set("organisationLeadership/writer", {active: true, scoutingRole: "Section Leader"});
  await saveHallBooking(store, "writer", {booking: {...occupancy(), id: "manual", title: "Private", hirerName: "Private", contact: "Private", notes: "Private"}, expectedRevision: 0}, now);
  store.records.set("siteSettings/hallHire", {enabled: false});
  const before = structuredClone([...store.records]);
  await assert.rejects(source(store), {code: "hall/conflict"}); assert.deepEqual([...store.records], before);
});
test("fresh authority, malformed mappings and source ownership failures write nothing", async () => {
  const store = memory(); const before = structuredClone([...store.records]);
  await assert.rejects(saveSourceHallReservation(store, "writer", "event", "one", async tx => {
    const [profile] = await tx.read(["adminUsers/writer"]); return {authorised: Boolean(profile?.active), occupancy: occupancy(), persist: () => tx.set("events/one", {title: "forged"})};
  }, now), {code: "hall/forbidden"});
  await assert.rejects(source(store, "meeting", "one", {...occupancy(), notes: "secret"}), {code: "hall/source"});
  assert.deepEqual([...store.records], before);
  const {bookingId} = await hallSourceIdentity("meeting", "same");
  store.records.set(`hall/group/bookings/${bookingId}`, {revision: 1, source: {collection: "events", id: "same"}});
  await assert.rejects(source(store), {code: "hall/source-owned"});
});
test("failed canonical persistence rolls back indexes, reservation and audit", async () => {
  const store = memory(), before = structuredClone([...store.records]);
  await assert.rejects(saveSourceHallReservation(store, "writer", "event", "one", async () => ({authorised: true, occupancy: occupancy(), persist: () => {throw new Error("source revision precondition");}}), now), /source revision/);
  assert.deepEqual([...store.records], before);
});
test("bounded recurrence exceptions release a single occurrence without corrupting the source series", async () => {
  const store = memory(), series = occupancy({recurrence: {frequency: "weekly", until: "2026-11-12"}});
  await source(store, "meeting", "weekly", series);
  await assert.rejects(source(store, "event", "collision", occupancy({interval: {...interval, date: "2026-11-05", endDate: "2026-11-05"}})), {code: "hall/conflict"});
  await source(store, "meeting", "weekly", {...series, exceptions: [{date: "2026-11-05", action: "cancel"}]});
  assert.deepEqual(store.records.get("hallAvailability/2026-11-05"), {occupied: []});
  assert.equal(store.records.get("hallAvailability/2026-11-12").occupied.length, 1);
});
