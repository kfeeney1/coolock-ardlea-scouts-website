import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
import {before, beforeEach, after, test} from "node:test";
import {initializeTestEnvironment, assertFails, assertSucceeds} from "@firebase/rules-unit-testing";
import {createMockUserToken} from "@firebase/util";
import {doc, getDoc, serverTimestamp, writeBatch} from "firebase/firestore";
import {initializeApp, deleteApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {planHallTestRehearsal, startHallTestRehearsal, stopHallTestRehearsal} from "../../scripts/hall-test-rehearsal.mjs";
import {readOperatorSnapshot, planHallReconciliation, applyHallReconciliation} from "../../scripts/hall-source-reconciliation.mjs";
import {planHallReadiness, HALL_ACCEPTANCE_CHECKS} from "../../scripts/hall-readiness.mjs";
import {handleHallBookingRoute} from "../../email-worker/src/hallBookingRoutes.js";
import {groupLocalDate} from "../../src/services/groupLocalDate.ts";
import {hallInstant, addHallDays} from "../../src/services/hallBookingTime.ts";
const projectId = "demo-hall-rehearsal", port = Number(process.env.FIRESTORE_RULES_EMULATOR_PORT || 8080), uid = "operator", commit = "a".repeat(40);
const runtime = {FIREBASE_PROJECT_ID: projectId, FIRESTORE_EMULATOR_HOST: `127.0.0.1:${port}`, ALLOWED_ORIGINS: "https://hall.test"};
const deployment = {project: projectId, commit, workerCommit: commit, functionalAcceptance: false, build: {commit, environment: "local", source: "local"}};
const scope = () => {const from = groupLocalDate(); return {from, through: addHallDays(from, 365)};};
const date = () => addHallDays(groupLocalDate(), 3);
const booking = () => ({id: "rehearsal-booking", resourceId: "group-hall", kind: "external", state: "confirmed", title: "PRIVATE PURPOSE", hirerName: "PRIVATE HIRER", contact: "PRIVATE CONTACT", notes: "PRIVATE NOTES", interval: {date: date(), startTime: "18:00", endDate: date(), endTime: "19:00"}});
let env, app, db;
before(async () => {env = await initializeTestEnvironment({projectId, firestore: {host: "127.0.0.1", port, rules: await readFile("firestore.rules", "utf8")}}); app = initializeApp({projectId}, "hall-rehearsal-tests"); db = getFirestore(app);});
after(async () => {await deleteApp(app); await env.cleanup();});
beforeEach(async () => {
  await env.clearFirestore();
  for (const [path, value] of [["hall/group", {ready: false, revision: 0}], ["siteSettings/hallHire", {enabled: false}], ["siteSettings/hallHirePublic", {enabled: false}], ["siteSettings/hallHireReadiness", {ready: false}],
    [`adminUsers/${uid}`, {active: true, role: "super-admin", sections: ["Cubs"]}], [`organisationLeadership/${uid}`, {active: true, scoutingRole: "Section Leader", organisationSection: "Cubs"}],
    ["adminUsers/ordinary", {active: true, role: "leader", sections: ["Cubs"]}], ["organisationLeadership/ordinary", {active: true, scoutingRole: "Scouter", organisationSection: "Cubs"}]]) await db.doc(path).set(value);
});
const plan = async () => planHallTestRehearsal(await readOperatorSnapshot(db, uid), uid, projectId, scope(), deployment);
const start = async value => startHallTestRehearsal(db, uid, projectId, scope(), deployment, (value ?? await plan()).digest);
async function request(body, actor = uid) {
  return handleHallBookingRoute(new Request("https://worker.invalid/hall-bookings", {method: "POST", headers: {Origin: "https://hall.test", Authorization: `Bearer ${createMockUserToken({sub: actor}, projectId)}`}, body: JSON.stringify(body)}), runtime, async () => "owner");
}
async function enable() {
  const client = env.authenticatedContext(uid).firestore(), batch = writeBatch(client);
  batch.set(doc(client, "siteSettings/hallHire"), {enabled: true, updatedBy: uid, updatedAt: serverTimestamp()}); batch.set(doc(client, "siteSettings/hallHirePublic"), {enabled: true}); await assertSucceeds(batch.commit());
}
test("controlled rehearsal permits real booking lifecycle/privacy; shutdown retains reservations, source data and audit", async () => {
  const before = (await db.doc("hall/group").get()).data(), value = await plan(); assert.equal(value.canStart, true); assert.deepEqual((await db.doc("hall/group").get()).data(), before);
  const opened = await start(value); assert.equal(opened.rolloutEnabled, false); assert.equal(opened.acceptanceRecorded, false);
  assert.equal((await db.doc("siteSettings/hallHirePublic").get()).get("enabled"), false);
  assert.equal((await db.doc("hall/group").get()).get("baselineVersion"), undefined);
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `hallAvailability/${date()}`)));
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext(uid)]) await assertFails(getDoc(doc(context.firestore(), "hall/group/testRehearsals/1")));
  await enable();
  assert.equal((await request({action: "save", command: {booking: booking(), expectedRevision: 0}})).status, 200);
  const moved = {...booking(), interval: {...booking().interval, startTime: "19:00", endTime: "20:00"}};
  assert.equal((await request({action: "save", command: {booking: moved, expectedRevision: 1}})).status, 200);
  assert.equal((await request({action: "list"}, "ordinary")).status, 403);
  const publicDay = await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), `hallAvailability/${date()}`)));
  assert.deepEqual(publicDay.data(), {occupied: [{start: new Date(hallInstant(date(), "19:00")).toISOString(), end: new Date(hallInstant(date(), "20:00")).toISOString()}]});
  await assertFails(getDoc(doc(env.authenticatedContext(uid).firestore(), "hall/group/bookings/rehearsal-booking")));
  const source = "weeklyMeetings/rehearsal-meeting";
  await db.doc(source).set({section: "Cubs", meetingDate: date(), status: "open", notes: "PRIVATE PROGRAMME", entries: [{memberId: "PRIVATE MEMBER"}], createdBy: uid});
  assert.equal((await request({action: "meeting-hall", command: {id: "rehearsal-meeting", expectedRevision: 0, expectedDate: date(), date: date(), startTime: "20:00", endTime: "21:00"}})).status, 200);
  const retained = await db.doc("hall/group/bookings/rehearsal-booking").get(), publicBefore = (await db.doc(`hallAvailability/${date()}`).get()).data();
  const result = await stopHallTestRehearsal(db, uid, projectId); assert.equal(result.recordsRetained, true); assert.equal(result.acceptanceRecorded, false);
  for (const path of ["siteSettings/hallHire", "siteSettings/hallHirePublic"]) assert.equal((await db.doc(path).get()).get("enabled"), false);
  assert.deepEqual((await db.doc("siteSettings/hallHireReadiness").get()).data(), {ready: false});
  const lock = (await db.doc("hall/group").get()).data(); assert.equal(lock.ready, false); assert.equal(lock.testRehearsal.state, "stopped"); assert.equal(lock.baselineVersion, undefined);
  assert.deepEqual((await db.doc(retained.ref.path).get()).data(), retained.data());
  assert.deepEqual((await db.doc(`hallAvailability/${date()}`).get()).data(), publicBefore);
  assert.equal((await db.doc(source).get()).get("notes"), "PRIVATE PROGRAMME");
  assert.equal((await db.doc("hall/group/bookings/rehearsal-booking/history/2").get()).exists, true);
  assert.equal((await db.doc("auditLog/hall-rehearsal-start-1").get()).get("action"), "hall-test-rehearsal-start");
  assert.equal((await db.collection("hall/group/readiness").get()).empty, true);
  assert.equal((await request({action: "list"})).status, 409);
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `hallAvailability/${date()}`)));
  // Existing source release remains authoritative while presentation/readiness are off.
  assert.equal((await request({action: "meeting-hall", command: {id: "rehearsal-meeting", expectedRevision: 1, expectedDate: date(), release: true}})).status, 200);
  assert.equal((await db.doc(source).get()).get("notes"), "PRIVATE PROGRAMME");
});
test("stale plans and concurrent starts fail atomically; no baseline or duplicate start audit is created", async () => {
  const value = await plan(); await db.doc("hall/group").update({revision: 1});
  await assert.rejects(start(value), {code: "hall/rehearsal-changed"}); assert.equal((await db.doc("hall/group").get()).get("ready"), false);
  const current = await plan(), results = await Promise.allSettled([start(current), start(current)]);
  assert.equal(results.filter(item => item.status === "fulfilled").length, 1); assert.equal(results.filter(item => item.status === "rejected").length, 1);
  assert.equal((await db.collection("hall/group/testRehearsals").get()).size, 1);
  assert.equal((await db.collection("auditLog").get()).size, 1);
});
test("revocation prevents a planned start; active Superuser can stop after Council loss and stop is idempotent", async () => {
  const value = await plan(); await db.doc(`organisationLeadership/${uid}`).update({active: false});
  await assert.rejects(start(value), {status: 403}); assert.equal((await db.doc("hall/group").get()).get("ready"), false);
  await db.doc(`organisationLeadership/${uid}`).update({active: true}); await start();
  await db.doc(`organisationLeadership/${uid}`).update({active: false});
  await assert.rejects(stopHallTestRehearsal(db, "ordinary", projectId), {status: 403});
  assert.equal((await stopHallTestRehearsal(db, uid, projectId)).stopped, true);
  const revision = (await db.doc("hall/group").get()).get("revision");
  assert.equal((await stopHallTestRehearsal(db, uid, projectId)).stopped, false); assert.equal((await db.doc("hall/group").get()).get("revision"), revision);
});
test("even with readiness revoked, active rehearsal blocks final acceptance publication and reconciliation", async () => {
  await start(); await db.doc("hall/group").update({ready: false}); await db.doc("siteSettings/hallHireReadiness").set({ready: false});
  const snapshot = await readOperatorSnapshot(db, uid), evidence = {schemaVersion: 1, jira: "SW-561", environment: "emulator", project: projectId, commit, workerCommit: commit, verifiedAt: new Date(Date.now() - 1000).toISOString(), verifiedByUid: uid, evidenceUrl: "emulator://synthetic", passedChecks: [...HALL_ACCEPTANCE_CHECKS]};
  await assert.rejects(planHallReadiness(snapshot, uid, projectId, scope(), evidence, deployment.build), {code: "hall/rehearsal-active"});
  await assert.rejects(planHallReconciliation(snapshot, uid, {schemaVersion: 1, ...scope(), decisions: []}), {code: "hall/rehearsal-active"});
  await stopHallTestRehearsal(db, uid, projectId);
  assert.equal((await planHallReadiness(await readOperatorSnapshot(db, uid), uid, projectId, scope(), evidence, deployment.build)).canPublish, true);
});
test("new unreviewed legacy facts invalidate a plan instead of being silently declared non-hall", async () => {
  const value = await plan();
  await db.doc("events/unconfirmed").set({section: "Cubs", startDate: "2029-01-01", endDate: "2029-01-01", status: "open"});
  await assert.rejects(start(value), {code: "hall/rehearsal-changed"}); assert.equal((await db.doc("hall/group").get()).get("ready"), false);
  const next = await plan(); assert.equal(next.canStart, false); assert.ok(next.blockers.some(item => item.code === "unconfirmed-source-use"));
  const snapshot = await readOperatorSnapshot(db, uid), manifest = {schemaVersion: 1, from: "2029-01-01", through: "2029-01-01", decisions: [{path: "events/unconfirmed", version: snapshot.versions.get("events/unconfirmed"), resource: "none"}]};
  const review = await planHallReconciliation(snapshot, uid, manifest); assert.equal(review.canApply, true);
  await applyHallReconciliation(db, uid, manifest, review.digest); assert.equal((await plan()).canStart, true);
});
test("failed immutable start audit leaves readiness and rollout unchanged", async () => {
  const value = await plan(); await db.doc("auditLog/hall-rehearsal-start-1").set({existing: true});
  await assert.rejects(start(value));
  assert.equal((await db.doc("hall/group").get()).get("ready"), false);
  assert.deepEqual((await db.doc("siteSettings/hallHireReadiness").get()).data(), {ready: false});
  assert.equal((await db.collection("hall/group/testRehearsals").get()).empty, true);
});
test("failed immutable stop audit cannot partially disable or replace the current resource lock", async () => {
  await start(); await enable(); const before = (await db.doc("hall/group").get()).data();
  await db.doc("auditLog/hall-rehearsal-stop-2").set({existing: true});
  await assert.rejects(stopHallTestRehearsal(db, uid, projectId));
  assert.deepEqual((await db.doc("hall/group").get()).data(), before);
  assert.equal((await db.doc("siteSettings/hallHirePublic").get()).get("enabled"), true);
  assert.equal((await db.doc("siteSettings/hallHireReadiness").get()).get("ready"), true);
});
