import test from "node:test";
import assert from "node:assert/strict";
import { saveHallMaintenanceSource } from "../src/hallMaintenanceSource.js";
import { hallSourceIdentity } from "../src/hallSourceReservation.js";
const id = "maintenance-appointment-001", uid = "council", now = Date.parse("2026-10-30T12:00Z");
const input = (changes = {}) => ({title: "PRIVATE Service", date: "2026-10-30", allDay: false, startTime: "19:00", endTime: "20:00", location: "PRIVATE location", notes: "PRIVATE task notes", hallResource: "group-hall", ...changes});
function store() {
  const records = new Map([["hall/group", {ready: true, revision: 0}], ["siteSettings/hallHire", {enabled: true}],
    [`adminUsers/${uid}`, {active: true, role: "leader", sections: ["Cubs"]}], [`organisationLeadership/${uid}`, {active: true, scoutingRole: "Section Leader"}],
    ["siteSettings/maintenanceExperience", {version: "redesigned", sdkRevision: 1}], ["siteSettings/calendarExperience", {version: "redesigned"}],
    [`maintenance/group/access/${uid}`, {kind: "leader", sourceId: uid}]]);
  return {records, async transaction(work) {const writes = []; const result = await work({read: async paths => paths.map(path => records.get(path) ?? null), set: (path, value) => writes.push([path, value]), create: (path, value) => {assert.equal(records.has(path), false); writes.push([path, value]);}}); writes.forEach(([path, value]) => records.set(path, structuredClone(value))); return result;}};
}
const save = (db, values = input(), revision = 0, changes = {}) => saveHallMaintenanceSource(db, uid, {id, expectedRevision: revision, input: values, ...changes}, {now});
test("maintenance source revisions and private details stay canonical; reschedule/release are atomic", async () => {
  const db = store(); assert.deepEqual(await save(db), {id, revision: 1});
  assert.equal(db.records.get(`maintenance/group/appointments/${id}`).notes, "PRIVATE task notes");
  const identity = await hallSourceIdentity("maintenance", id);
  assert.equal(JSON.stringify(db.records.get(`hall/group/bookings/${identity.bookingId}`)).includes("PRIVATE"), false);
  await save(db, input({date: "2026-10-31"}), 1);
  assert.deepEqual(db.records.get("hallAvailability/2026-10-30"), {occupied: []});
  assert.equal(db.records.get("hallAvailability/2026-10-31").occupied.length, 1);
  await save(db, input({hallResource: ""}), 2);
  assert.deepEqual(db.records.get("hallAvailability/2026-10-31"), {occupied: []});
  assert.equal(db.records.get(`maintenance/group/appointments/${id}`).hallResource, undefined);
});
test("Council cannot bypass canonical membership, switches, active appointments or stale revisions", async () => {
  for (const [path, value] of [[`adminUsers/${uid}`, {active: false}], [`organisationLeadership/${uid}`, {active: true, scoutingRole: "Programme Scouter"}],
    ["siteSettings/maintenanceExperience", {version: "existing", sdkRevision: 1}], ["siteSettings/calendarExperience", {version: "existing"}],
    [`maintenance/group/access/${uid}`, {kind: "parent", sourceId: uid}], [`maintenance/group/access/${uid}`, {kind: "leader", sourceId: "other"}]]) {
    const db = store(); db.records.set(path, value); const before = structuredClone([...db.records]); await assert.rejects(save(db), {status: 403}); assert.deepEqual([...db.records], before);
  }
  const db = store(); await save(db); const before = structuredClone([...db.records]); await assert.rejects(save(db), {code: "hall/stale"}); assert.deepEqual([...db.records], before);
});
test("off-state blocks new hall choices but retains conflict enforcement and cancellation for existing sources", async () => {
  const db = store(); db.records.set("siteSettings/hallHire", {enabled: false});
  await assert.rejects(save(db), {code: "hall/disabled"});
  db.records.set("siteSettings/hallHire", {enabled: true}); await save(db);
  db.records.set("siteSettings/hallHire", {enabled: false}); db.records.set("hall/group", {...db.records.get("hall/group"), ready: false});
  await save(db, input({endTime: "21:00"}), 1);
  await saveHallMaintenanceSource(db, uid, {id, expectedRevision: 2}, {cancel: true, now});
  assert.equal(db.records.get(`maintenance/group/appointments/${id}`).cancelled, true);
  assert.deepEqual(db.records.get("hallAvailability/2026-10-30"), {occupied: []});
});
test("all-day maintenance reserves the actual 23/25-hour Dublin day; gap and fold times rejected", async () => {
  for (const [date, hours] of [["2026-03-29", 23], ["2026-10-25", 25]]) {
    const db = store(); await save(db, input({date, allDay: true})); const [slot] = db.records.get(`hallAvailability/${date}`).occupied;
    assert.equal((Date.parse(slot.end) - Date.parse(slot.start)) / 3_600_000, hours);
    const rejected = store(); await assert.rejects(save(rejected, input({date, startTime: "01:30", endTime: "03:00"})), {code: "hall/invalid"});
  }
});
test("linked task ownership is immutable and missing tasks or injected metadata fail closed", async () => {
  const taskId = "maintenance-task-source-001", appointmentId = `task-${taskId}`, db = store();
  await assert.rejects(save(db, input(), 0, {id: appointmentId, taskId}), {code: "hall/source-owned"});
  db.records.set(`maintenance/group/tasks/${taskId}`, {description: "PRIVATE TASK"});
  await save(db, input(), 0, {id: appointmentId, taskId});
  assert.equal(db.records.get(`maintenance/group/appointments/${appointmentId}`).title, "");
  await assert.rejects(save(db, input({source: {id: "forged"}})), {code: "hall/invalid"});
  await assert.rejects(save(db, input({hallResource: "different-hall"})), {code: "hall/invalid"});
  await assert.rejects(save(db, input(), 1, {id: appointmentId, taskId: "another-maintenance-task-001"}), {code: "hall/invalid"});
});
