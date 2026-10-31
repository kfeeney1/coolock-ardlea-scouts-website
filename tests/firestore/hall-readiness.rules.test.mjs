import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
import {before, beforeEach, after, test} from "node:test";
import {initializeTestEnvironment, assertFails} from "@firebase/rules-unit-testing";
import {doc, getDoc} from "firebase/firestore";
import {initializeApp, deleteApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {hallFirestore} from "../../email-worker/src/hallFirestore.js";
import {saveHallMeetingSource} from "../../email-worker/src/hallMeetingSource.js";
import {planHallReconciliation, readOperatorSnapshot, applyHallReconciliation, applyHallDecision} from "../../scripts/hall-source-reconciliation.mjs";
import {planHallReadiness, publishHallReadiness, revokeHallReadiness, HALL_ACCEPTANCE_CHECKS} from "../../scripts/hall-readiness.mjs";
import {readHallAuditSnapshot} from "../../scripts/hall-reconciliation-reader.mjs";
import {auditHallReservations, HALL_AUDIT_COLLECTIONS} from "../../scripts/hall-reconciliation.mjs";
import {hallSourceIdentity} from "../../email-worker/src/hallSourceReservation.js";
import {groupLocalDate} from "../../src/services/groupLocalDate.ts";
import {addHallDays} from "../../src/services/hallBookingTime.ts";
const projectId = "demo-hall-readiness", port = Number(process.env.FIRESTORE_RULES_EMULATOR_PORT || 8080), uid = "operator", date = "2026-11-05";
let env, app, db;
const paths = ["weeklyMeetings/legacy-meeting", "events/legacy-event", "maintenance/group/appointments/maintenance-legacy-001"];
const scope = () => {const from = groupLocalDate(); return {from, through: addHallDays(from, 365)};};
const evidence = () => ({schemaVersion: 1, jira: "SW-561", environment: "emulator", project: projectId, commit: "a".repeat(40), workerCommit: "a".repeat(40), verifiedAt: new Date(Date.now() - 1000).toISOString(), verifiedByUid: uid, evidenceUrl: "emulator://synthetic", passedChecks: [...HALL_ACCEPTANCE_CHECKS]});
const build = {commit: "a".repeat(40), environment: "local", source: "local"};
const store = () => hallFirestore({FIREBASE_PROJECT_ID: projectId, FIRESTORE_EMULATOR_HOST: `127.0.0.1:${port}`}, "owner");
before(async () => {env = await initializeTestEnvironment({projectId, firestore: {host: "127.0.0.1", port, rules: await readFile("firestore.rules", "utf8")}}); app = initializeApp({projectId}, "hall-readiness-tests"); db = getFirestore(app);});
after(async () => {await deleteApp(app); await env.cleanup();});
beforeEach(async () => {
  await env.clearFirestore();
  for (const [path, value] of [["hall/group", {ready: false, revision: 0}], ["siteSettings/hallHire", {enabled: false}], ["siteSettings/hallHirePublic", {enabled: false}], ["siteSettings/hallHireReadiness", {ready: false}],
    [`adminUsers/${uid}`, {active: true, role: "super-admin", sections: ["Cubs"]}], [`organisationLeadership/${uid}`, {active: true, scoutingRole: "Section Leader"}],
    ["siteSettings/maintenanceExperience", {version: "redesigned", sdkRevision: 1}], ["siteSettings/calendarExperience", {version: "redesigned"}], [`maintenance/group/access/${uid}`, {kind: "leader", sourceId: uid}],
    [paths[0], {section: "Cubs", meetingDate: date, status: "open", notes: "PRIVATE programme", entries: [{memberId: "PRIVATE member"}], createdBy: "original"}],
    [paths[1], {section: "Cubs", startDate: date, endDate: date, status: "open", title: "PRIVATE event", leaderNotes: "PRIVATE leader notes", consent: {private: "received"}, createdBy: "original"}],
    [paths[2], {date, allDay: false, startTime: "20:00", endTime: "21:00", title: "PRIVATE maintenance", notes: "PRIVATE maintenance note", revision: 1, createdBy: "original"}],
    ["parentWeeklyMeetings/legacy-meeting", {section: "Cubs", meetingDate: date, status: "open", theme: "Parent projection", activities: [], badgework: []}]]) await db.doc(path).set(value);
});
async function manifest(resources = ["group-hall", "none", "group-hall"]) {
  const snapshot = await readOperatorSnapshot(db, uid);
  return {schemaVersion: 1, from: date, through: "2026-11-06", decisions: paths.map((path, index) => ({path, version: snapshot.versions.get(path), resource: resources[index], ...(resources[index] === "group-hall" ? {interval: {date, startTime: index === 0 ? "18:00" : index === 1 ? "19:00" : "20:00", endDate: date, endTime: index === 0 ? "19:00" : index === 1 ? "20:00" : "21:00"}} : {})}))};
}
async function apply(value) {const plan = await planHallReconciliation(await readOperatorSnapshot(db, uid), uid, value); assert.equal(plan.canApply, true, JSON.stringify(plan.blockers)); return applyHallReconciliation(db, uid, value, plan.digest);}
async function state() {
  const docs = [];
  for (const collection of [...Object.keys(HALL_AUDIT_COLLECTIONS), "hall", "siteSettings", "auditLog", "parentWeeklyMeetings"]) docs.push(...(await db.collection(collection).get()).docs);
  for (const item of docs.filter(item => ["hall/group/bookings", "hall/group/sourceReviews"].includes(item.ref.parent.path))) docs.push(...(await item.ref.collection("history").get()).docs);
  return docs.map(item => ({path: item.ref.path, data: item.data(), version: item.updateTime})).sort((a, b) => a.path.localeCompare(b.path));
}
test("reviewed imports are dry-run bound, atomic per source, private, programme-preserving and idempotently resumable", async () => {
  const input = await manifest(), before = await state();
  const plan = await planHallReconciliation(await readOperatorSnapshot(db, uid), uid, input); assert.equal(plan.canApply, true); assert.deepEqual(await state(), before);
  await assert.rejects(applyHallReconciliation(db, uid, input, "b".repeat(64)), {code: "hall/plan-changed"}); assert.deepEqual(await state(), before);
  const result = await applyHallReconciliation(db, uid, input, plan.digest); assert.equal(result.complete, true);
  assert.equal((await db.doc(paths[0]).get()).get("notes"), "PRIVATE programme"); assert.equal((await db.doc(paths[1]).get()).get("consent.private"), "received"); assert.equal((await db.doc(paths[2]).get()).get("createdBy"), "original");
  assert.equal((await db.doc("parentWeeklyMeetings/legacy-meeting").get()).get("theme"), "Parent projection");
  const report = await auditHallReservations(await readHallAuditSnapshot(db), {...scope(), allIndexedDays: true}); assert.equal(report.consistent, true, JSON.stringify(report.issues)); assert.equal(JSON.stringify(report).includes("PRIVATE"), false);
  const committed = await state(), again = await apply(input); assert.ok(again.results.every(item => item.result === "already-applied")); assert.deepEqual(await state(), committed);
  const {bookingId} = await hallSourceIdentity("event", "legacy-event");
  await assertFails(getDoc(doc(env.authenticatedContext(uid).firestore(), `hall/group/sourceReviews/${bookingId}`)));
  assert.deepEqual((await db.doc("siteSettings/hallHireReadiness").get()).data(), {ready: false});
});
test("revoked authority and stale source versions fail at the write boundary without applying a plan", async () => {
  const input = await manifest(), plan = await planHallReconciliation(await readOperatorSnapshot(db, uid), uid, input);
  await db.doc(paths[0]).update({notes: "Changed after review"}); const before = await state();
  await assert.rejects(applyHallReconciliation(db, uid, input, plan.digest), {code: "hall/plan-changed"}); await assert.rejects(applyHallDecision(db, uid, input.decisions[0]), {code: "hall/stale"}); assert.deepEqual(await state(), before);
  await db.doc(`organisationLeadership/${uid}`).update({active: false}); const revoked = await state(); await assert.rejects(applyHallDecision(db, uid, input.decisions[1]), {status: 403}); assert.deepEqual(await state(), revoked);
});
test("partial application reports committed sources and resumes only from a new reviewed plan", async () => {
  const input = await manifest(["none", "none", "none"]), plan = await planHallReconciliation(await readOperatorSnapshot(db, uid), uid, input); let writes = 0;
  const racing = {projectId, doc: path => db.doc(path), collection: path => db.collection(path), runTransaction: async (work, options) => {
    if (!options?.readOnly && ++writes === 2) await db.doc(paths[1]).update({leaderNotes: "Concurrent ordinary edit"});
    return db.runTransaction(work, options);
  }};
  const result = await applyHallReconciliation(racing, uid, input, plan.digest); assert.equal(result.complete, false); assert.equal(result.results.length, 1); assert.equal(result.failed.code, "hall/stale"); assert.deepEqual(result.remaining, paths.slice(1));
  const next = await manifest(["none", "none", "none"]); next.decisions[0] = input.decisions[0];
  const resumed = await apply(next); assert.equal(resumed.complete, true); assert.equal(resumed.results[0].result, "already-applied");
  assert.equal((await db.doc("hall/group/bookings/no-record").get()).exists, false);
});
test("operator import and off-state source reschedule share the same concurrent conflict lock", async () => {
  const input = await manifest(["group-hall", "none", "none"]); await apply(input);
  await db.doc("events/racing-event").set({section: "Cubs", startDate: date, endDate: date, status: "open"});
  const snapshot = await readOperatorSnapshot(db, uid), decision = {path: "events/racing-event", version: snapshot.versions.get("events/racing-event"), resource: "group-hall", interval: {date, startTime: "19:00", endDate: date, endTime: "20:00"}};
  const results = await Promise.allSettled([applyHallDecision(db, uid, decision), saveHallMeetingSource(store(), uid, {id: "legacy-meeting", expectedRevision: 1, expectedDate: date, date, startTime: "19:00", endTime: "20:00"})]);
  assert.equal(results.filter(item => item.status === "fulfilled").length, 1); assert.equal(results.find(item => item.status === "rejected").reason.code, "hall/conflict");
  assert.equal((await db.doc("events/racing-event").get()).get("hallResource") === "group-hall", results[0].status === "fulfilled");
});
test("publication binds complete reconciliation and TEST evidence; rollback preserves bookings and baseline intent", async () => {
  await apply(await manifest()); const acceptance = evidence(), range = scope(), snapshot = await readOperatorSnapshot(db, uid);
  const plan = await planHallReadiness(snapshot, uid, projectId, range, acceptance, build); assert.equal(plan.canPublish, true, JSON.stringify(plan.blockers));
  await assert.rejects(publishHallReadiness(db, uid, projectId, range, {...acceptance, passedChecks: ["quality"]}, build, plan.digest));
  const result = await publishHallReadiness(db, uid, projectId, range, acceptance, build, plan.digest); assert.equal(result.published, true); assert.equal(result.rolloutEnabled, false);
  assert.deepEqual((await db.doc("siteSettings/hallHireReadiness").get()).data(), {ready: true}); assert.equal((await db.doc("siteSettings/hallHire").get()).get("enabled"), false);
  const baseline = (await db.doc("hall/group").get()).get("baselineVersion"); assert.match(baseline, /^\d+:\d+$/);
  await db.doc("events/new-default").set({section: "Cubs", startDate: date, endDate: date, status: "open", createdAt: "1900-01-01"});
  await db.doc(paths[1]).update({startDate: "2026-11-07", endDate: "2026-11-07", leaderNotes: "Ordinary programme edit"});
  assert.equal((await auditHallReservations(await readHallAuditSnapshot(db), {...range, allIndexedDays: true})).consistent, true);
  const bookings = (await db.collection("hall/group/bookings").get()).docs.map(item => item.data());
  await db.doc(`organisationLeadership/${uid}`).update({active: false}); await revokeHallReadiness(db, uid, projectId);
  assert.deepEqual((await db.doc("siteSettings/hallHireReadiness").get()).data(), {ready: false}); assert.equal((await db.doc("hall/group").get()).get("baselineVersion"), baseline);
  assert.deepEqual((await db.collection("hall/group/bookings").get()).docs.map(item => item.data()), bookings);
});
test("new legacy facts or missing current review audit evidence invalidate readiness before publication", async () => {
  await apply(await manifest()); const acceptance = evidence(), range = scope(), plan = await planHallReadiness(await readOperatorSnapshot(db, uid), uid, projectId, range, acceptance, build);
  await db.doc("events/late-source").set({section: "Cubs", startDate: "2099-01-01", endDate: "2099-01-01", status: "open"});
  await assert.rejects(publishHallReadiness(db, uid, projectId, range, acceptance, build, plan.digest), {code: "hall/readiness-changed"}); assert.equal((await db.doc("hall/group").get()).get("ready"), false);
  await db.doc("events/late-source").delete(); const {bookingId} = await hallSourceIdentity("event", "legacy-event"); await db.doc(`hall/group/sourceReviews/${bookingId}/history/1`).delete();
  const audit = await auditHallReservations(await readHallAuditSnapshot(db), {...range, allIndexedDays: true}); assert.ok(audit.issues.some(item => item.code === "invalid-source-review"));
});
test("Maintenance revocation blocks import and released deleted sources retain valid historical audit ownership", async () => {
  const input = await manifest(); await db.doc(`maintenance/group/access/${uid}`).delete();
  await assert.rejects(applyHallDecision(db, uid, input.decisions[2]), {status: 403});
  await db.doc(`maintenance/group/access/${uid}`).set({kind: "leader", sourceId: uid}); await apply(input);
  await saveHallMeetingSource(store(), uid, {id: "legacy-meeting", expectedRevision: 1, expectedDate: date, release: true});
  await db.doc(paths[0]).delete();
  const report = await auditHallReservations(await readHallAuditSnapshot(db), {...scope(), allIndexedDays: true}); assert.equal(report.consistent, true, JSON.stringify(report.issues));
});
test("historical confirmed use can be backfilled without reopening completed programme records", async () => {
  await db.doc(paths[1]).update({startDate: "2026-01-05", endDate: "2026-01-05", status: "completed"});
  const snapshot = await readOperatorSnapshot(db, uid), input = {schemaVersion: 1, from: "2026-01-05", through: "2026-01-06", decisions: [{path: paths[1], version: snapshot.versions.get(paths[1]), resource: "group-hall", interval: {date: "2026-01-05", startTime: "18:00", endDate: "2026-01-05", endTime: "19:00"}}]};
  await apply(input); const source = (await db.doc(paths[1]).get()).data();
  assert.equal(source.status, "completed"); assert.equal(source.leaderNotes, "PRIVATE leader notes"); assert.equal(source.consent.private, "received"); assert.equal(source.hallResource, "group-hall");
});
