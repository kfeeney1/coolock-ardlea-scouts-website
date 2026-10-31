import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
import {before, beforeEach, after, test} from "node:test";
import {initializeTestEnvironment} from "@firebase/rules-unit-testing";
import {initializeApp, deleteApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {hallFirestore} from "../../email-worker/src/hallFirestore.js";
import {saveHallBooking} from "../../email-worker/src/hallBookingModel.js";
import {saveHallMeetingSource} from "../../email-worker/src/hallMeetingSource.js";
import {saveHallEventSource} from "../../email-worker/src/hallEventSource.js";
import {saveHallMaintenanceSource} from "../../email-worker/src/hallMaintenanceSource.js";
import {readHallAuditSnapshot} from "../../scripts/hall-reconciliation-reader.mjs";
import {auditHallReservations, HALL_AUDIT_LIMIT, HALL_AUDIT_COLLECTIONS} from "../../scripts/hall-reconciliation.mjs";
import {runHallAudit} from "../../scripts/audit-hall-reservations.mjs";
const projectId = "demo-hall-reconciliation", port = Number(process.env.FIRESTORE_RULES_EMULATOR_PORT || 8080), date = "2026-11-05";
const options = {from: date, through: "2026-11-12"}, uid = "council";
let env, app, db;
const store = () => hallFirestore({FIREBASE_PROJECT_ID: projectId, FIRESTORE_EMULATOR_HOST: `127.0.0.1:${port}`}, "owner");
before(async () => {
  env = await initializeTestEnvironment({projectId, firestore: {host: "127.0.0.1", port, rules: await readFile("firestore.rules", "utf8")}});
  app = initializeApp({projectId}, "hall-reconciliation-tests"); db = getFirestore(app);
});
after(async () => {await deleteApp(app); await env.cleanup();});
beforeEach(async () => {
  await env.clearFirestore();
  for (const [path, value] of [["hall/group", {ready: true, revision: 0}], ["siteSettings/hallHire", {enabled: true}], ["siteSettings/hallHirePublic", {enabled: true}], ["siteSettings/hallHireReadiness", {ready: true}],
    [`adminUsers/${uid}`, {active: true, role: "leader", sections: ["Cubs"]}], [`organisationLeadership/${uid}`, {active: true, scoutingRole: "Section Leader"}],
    ["siteSettings/maintenanceExperience", {version: "redesigned", sdkRevision: 1}], ["siteSettings/calendarExperience", {version: "redesigned"}], [`maintenance/group/access/${uid}`, {kind: "leader", sourceId: uid}],
    ["weeklyMeetings/meeting-audit", {meetingDate: date, section: "Cubs", status: "open", notes: "PRIVATE programme", entries: [{memberId: "PRIVATE member"}]}],
    ["events/event-audit", {startDate: date, endDate: date, section: "Cubs", status: "open", title: "PRIVATE event", leaderNotes: "PRIVATE notes", consent: {private: "received"}}]]) await db.doc(path).set(value);
});
async function seedReservations() {
  await saveHallMeetingSource(store(), uid, {id: "meeting-audit", expectedRevision: 0, expectedDate: date, date, startTime: "18:00", endTime: "19:00"});
  await saveHallEventSource(store(), uid, {id: "event-audit", expectedRevision: 0, expectedStartDate: date, expectedEndDate: date, interval: {date, startTime: "20:00", endDate: date, endTime: "21:00"}});
  await saveHallMaintenanceSource(store(), uid, {id: "maintenance-audit-0001", expectedRevision: 0, input: {title: "PRIVATE appointment", date, allDay: false, startTime: "21:00", endTime: "22:00", location: "PRIVATE location", notes: "PRIVATE note", hallResource: "group-hall"}});
  await saveHallBooking(store(), uid, {expectedRevision: 0, booking: {id: "manual-audit", resourceId: "group-hall", kind: "external", state: "confirmed", interval: {date, startTime: "19:00", endDate: date, endTime: "20:00"}, recurrence: {frequency: "weekly", until: "2026-11-12"}, title: "PRIVATE purpose", hirerName: "PRIVATE name", contact: "PRIVATE contact", notes: "PRIVATE note"}});
}
async function evidence() {
  const docs = [];
  for (const path of [...Object.keys(HALL_AUDIT_COLLECTIONS), "siteSettings", "auditLog", "hall"]) docs.push(...(await db.collection(path).get()).docs);
  for (const item of docs.filter(item => item.ref.parent.path === "hall/group/bookings")) docs.push(...(await item.ref.collection("history").get()).docs);
  return docs.map(item => ({path: item.ref.path, data: item.data(), version: item.updateTime})).sort((a, b) => a.path.localeCompare(b.path));
}
test("actual meeting/event/maintenance/manual writes reconcile in one read-only snapshot, without private payloads or mutations", async () => {
  await seedReservations(); const before = await evidence();
  const snapshot = await readHallAuditSnapshot(db), report = await auditHallReservations(snapshot, options);
  assert.equal(report.consistent, true, JSON.stringify(report.issues)); assert.equal(report.activationApproved, false); assert.deepEqual(report.inventory, []);
  assert.equal(JSON.stringify(report).includes("PRIVATE"), false);
  assert.equal(JSON.stringify([...snapshot.collections].map(([path, rows]) => [path, [...rows]])).includes("PRIVATE"), false, "reader field masks must exclude source programme and private booking content");
  assert.equal(snapshot.collections.get("weeklyMeetings").get("meeting-audit").notes, undefined);
  assert.equal(snapshot.collections.get("hall/group/bookings").get("manual-audit").contact, undefined);
  const cli = await runHallAudit([`--project=${projectId}`, `--from=${options.from}`, `--through=${options.through}`], {...process.env, GCLOUD_PROJECT: projectId});
  assert.equal(cli.consistent, true); assert.deepEqual(await evidence(), before);
});
test("missing/stale public indexes are reported and never repaired, including private leakage", async () => {
  await seedReservations(); await db.doc(`hallAvailability/${date}`).delete();
  const missing = await auditHallReservations(await readHallAuditSnapshot(db), options);
  assert.ok(missing.issues.some(item => item.code === "public-availability-mismatch")); assert.equal((await db.doc(`hallAvailability/${date}`).get()).exists, false);
  await db.doc(`hallAvailability/${date}`).set({occupied: [], contact: "PRIVATE leak"});
  const report = await auditHallReservations(await readHallAuditSnapshot(db), options);
  assert.ok(report.issues.some(item => item.code === "public-privacy-shape")); assert.equal(JSON.stringify(report).includes("PRIVATE"), false);
  assert.equal((await db.doc(`hallAvailability/${date}`).get()).get("contact"), "PRIVATE leak", "audit cannot silently repair evidence");
});
test("legacy review decisions bind to exact updateTime even when an unselected programme field changes", async () => {
  await seedReservations(); await db.doc("events/legacy-audit").set({startDate: date, endDate: date, status: "open", title: "PRIVATE", location: "Hall"});
  const first = await readHallAuditSnapshot(db), path = "events/legacy-audit";
  const report = await auditHallReservations(first, options); assert.ok(report.issues.some(item => item.code === "unconfirmed-source-use"));
  const decisions = [{path, version: first.versions.get(path), resource: "none"}];
  assert.equal((await auditHallReservations(first, {...options, decisions})).consistent, true);
  await db.doc(path).update({leaderNotes: "PRIVATE changed"});
  const stale = await auditHallReservations(await readHallAuditSnapshot(db), {...options, decisions}); assert.ok(stale.issues.some(item => item.code === "stale-decision"));
});
test("reader rejects a collection over its scan ceiling rather than approving partial inventory", async () => {
  await db.doc("weeklyMeetings/meeting-audit").delete(); await db.doc("events/event-audit").delete();
  for (let offset = 0; offset <= HALL_AUDIT_LIMIT; offset += 400) {
    const batch = db.batch();
    for (let index = offset; index <= Math.min(HALL_AUDIT_LIMIT, offset + 399); index++) batch.set(db.doc(`events/legacy-${index}`), {startDate: date, endDate: date, status: "open"});
    await batch.commit();
  }
  const snapshot = await readHallAuditSnapshot(db); assert.ok(snapshot.truncated.includes("events")); assert.equal(snapshot.collections.get("events").size, HALL_AUDIT_LIMIT);
  const report = await auditHallReservations(snapshot, options); assert.equal(report.consistent, false); assert.ok(report.issues.some(item => item.code === "scan-limit"));
  assert.equal((await db.collection("events").count().get()).data().count, HALL_AUDIT_LIMIT + 1);
});

test("authoritative release/cancellation remains reconciled off-state without inventing legacy classifications", async () => {
  await seedReservations();
  await db.doc("siteSettings/hallHire").set({enabled: false}); await db.doc("siteSettings/hallHirePublic").set({enabled: false});
  await saveHallMeetingSource(store(), uid, {id: "meeting-audit", expectedRevision: 1, expectedDate: date, release: true});
  await saveHallEventSource(store(), uid, {id: "event-audit", expectedRevision: 1, expectedStartDate: date, expectedEndDate: date, release: true});
  await saveHallMaintenanceSource(store(), uid, {id: "maintenance-audit-0001", expectedRevision: 1}, {cancel: true});
  const report = await auditHallReservations(await readHallAuditSnapshot(db), options);
  assert.deepEqual(report.issues, []); assert.equal(report.consistent, true); assert.equal(report.activationApproved, false);
  assert.deepEqual(report.inventory, []); assert.equal((await db.doc("hall/group").get()).get("ready"), true, "isolated fixture readiness is not changed by audit");
});
test("a concurrent source reschedule cannot mix source, reservation and projection versions in the audit snapshot", async () => {
  await seedReservations();
  const [report] = await Promise.all([
    readHallAuditSnapshot(db).then(snapshot => auditHallReservations(snapshot, options)),
    saveHallMeetingSource(store(), uid, {id: "meeting-audit", expectedRevision: 1, expectedDate: date, date, startTime: "18:00", endTime: "18:30"})
  ]);
  assert.equal(report.consistent, true, JSON.stringify(report.issues));
  assert.equal((await db.doc("weeklyMeetings/meeting-audit").get()).get("hallEndTime"), "18:30");
});
