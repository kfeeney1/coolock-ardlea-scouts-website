import test from "node:test";
import assert from "node:assert/strict";
import {hallMeetingScope, saveHallMeetingSource} from "../src/hallMeetingSource.js";
import {hallSourceIdentity} from "../src/hallSourceReservation.js";
const id = "meeting-source-001", uid = "council", now = Date.parse("2026-10-30T12:00Z");
const source = {section: "Cubs", meetingDate: "2026-11-05", status: "open", location: "PRIVATE location", plannedActivities: "PRIVATE leaders and programme", plannedBadgework: "PRIVATE badge plan", programmeNotes: "PRIVATE notes", notes: "PRIVATE leader notes", entries: [{memberId: "PRIVATE member"}], injuries: [{concern: "PRIVATE concern"}], createdBy: "original", createdAt: "2026-10-01T12:00:00Z"};
function store() {
  const records = new Map([["hall/group", {ready: true, revision: 0}], ["siteSettings/hallHire", {enabled: true}], [`adminUsers/${uid}`, {active: true, role: "leader", sections: ["Cubs"]}], [`organisationLeadership/${uid}`, {active: true, scoutingRole: "Section Leader"}], [`weeklyMeetings/${id}`, structuredClone(source)], [`parentWeeklyMeetings/${id}`, {section: "Cubs", meetingDate: source.meetingDate, status: "open", location: "Published location", theme: "Published theme", activities: [{name: "Public game", durationMinutes: 20, equipment: "Cones"}], badgework: []}]]);
  return {records, async transaction(work) {const writes = []; const result = await work({read: async paths => paths.map(path => records.get(path) ?? null), set: (path, value) => writes.push([path, value]), patch: (path, value, removed = []) => {const next = {...records.get(path), ...value}; removed.forEach(key => delete next[key]); writes.push([path, next]);}, create: (path, value) => {assert.equal(records.has(path), false); writes.push([path, value]);}}); writes.forEach(([path, value]) => records.set(path, structuredClone(value))); return result;}};
}
const save = (db, changes = {}) => saveHallMeetingSource(db, uid, {id, expectedRevision: 0, expectedDate: source.meetingDate, date: source.meetingDate, startTime: "19:00", endTime: "20:00", ...changes}, now);
const release = (db, revision = 1, date = source.meetingDate) => saveHallMeetingSource(db, uid, {id, expectedRevision: revision, expectedDate: date, release: true}, now);
test("source-only reserve and reschedule preserve programme/attendance and parent projection", async () => {
  const db = store(); assert.deepEqual(await save(db), {id, revision: 1});
  const stored = db.records.get(`weeklyMeetings/${id}`);
  for (const key of ["entries", "injuries", "plannedActivities", "plannedBadgework", "notes", "createdBy", "createdAt"]) assert.deepEqual(stored[key], source[key]);
  const {bookingId} = await hallSourceIdentity("meeting", id);
  assert.equal(JSON.stringify(db.records.get(`hall/group/bookings/${bookingId}`)).includes("PRIVATE"), false);
  const parent = db.records.get(`parentWeeklyMeetings/${id}`);
  await save(db, {expectedRevision: 1, date: "2026-11-06"});
  const parentNext = db.records.get(`parentWeeklyMeetings/${id}`);
  assert.equal(parentNext.meetingDate, "2026-11-06"); assert.deepEqual(parentNext.activities, parent.activities);
  assert.deepEqual(db.records.get(`hallAvailability/${source.meetingDate}`), {occupied: []});
  assert.equal(db.records.get("hallAvailability/2026-11-06").occupied.length, 1);
});
test("Council cannot obtain another section's programme write rights or bypass revocation", async () => {
  for (const change of [{active: false, scoutingRole: "Section Leader"}, {active: true, scoutingRole: "Scouter"}]) {
    const db = store(); db.records.set(`organisationLeadership/${uid}`, change); const before = structuredClone([...db.records]); await assert.rejects(save(db), {status: 403}); assert.deepEqual([...db.records], before);
  }
  const db = store(); db.records.set(`weeklyMeetings/${id}`, {...source, section: "Scouts"}); await assert.rejects(save(db), {status: 403});
  assert.equal(hallMeetingScope({role: "leader", sections: ["Cubs"]}, {active: true, scoutingRole: "Group Secretary"}, "Scouts"), false);
  assert.equal(hallMeetingScope({role: "leader", sections: ["Group"]}, {active: true, scoutingRole: "Deputy Group Leader"}, "Scouts"), true);
  assert.equal(hallMeetingScope({role: "leader", sections: ["Cubs"]}, {}, "Cub Scout"), true);
});
test("stale source revisions and ordinary date edits cannot silently move a reservation", async () => {
  const db = store(); await save(db); const before = structuredClone([...db.records]); await assert.rejects(save(db), {code: "hall/stale"}); assert.deepEqual([...db.records], before);
  const second = store(); second.records.set(`weeklyMeetings/${id}`, {...source, meetingDate: "2026-11-07"}); await assert.rejects(save(second), {code: "hall/stale"});
});
test("existing sources remain protected and releasable off-state, including closed meetings", async () => {
  const db = store(); db.records.set("siteSettings/hallHire", {enabled: false}); await assert.rejects(save(db), {code: "hall/disabled"});
  db.records.set("siteSettings/hallHire", {enabled: true}); await save(db); db.records.set("siteSettings/hallHire", {enabled: false});
  await save(db, {expectedRevision: 1, endTime: "21:00"});
  const canonical = db.records.get(`weeklyMeetings/${id}`); db.records.set(`weeklyMeetings/${id}`, {...canonical, status: "closed"});
  await assert.rejects(save(db, {expectedRevision: 2}), {code: "hall/closed"});
  await release(db, 2); assert.equal(db.records.get(`weeklyMeetings/${id}`).status, "closed"); assert.equal(db.records.get(`weeklyMeetings/${id}`).hallResource, undefined);
  assert.deepEqual(db.records.get(`hallAvailability/${source.meetingDate}`), {occupied: []});
});
test("missing/stale/unsafe legacy parent projection blocks a date move atomically", async () => {
  for (const value of [null, {section: "Scouts"}, {section: "Cubs", meetingDate: source.meetingDate, status: "open", location: "", theme: "", activities: [{name: "Safe", durationMinutes: 1, equipment: "", private: "PRIVATE"}], badgework: []}]) {
    const db = store(); await save(db); db.records.set(`parentWeeklyMeetings/${id}`, value); const before = structuredClone([...db.records]);
    await assert.rejects(save(db, {expectedRevision: 1, date: "2026-11-06"}), {code: "hall/reconcile"}); assert.deepEqual([...db.records], before);
  }
});
test("client programme injection and ambiguous Dublin clock-change times are rejected", async () => {
  const db = store(); await assert.rejects(save(db, {entries: []}), {code: "hall/invalid"});
  await assert.rejects(save(db, {date: "2026-10-25", startTime: "01:30", endTime: "03:00"}), {code: "hall/invalid"});
});
