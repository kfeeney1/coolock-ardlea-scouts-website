import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
import {before, beforeEach, after, test} from "node:test";
import {assertFails, assertSucceeds, initializeTestEnvironment} from "@firebase/rules-unit-testing";
import {doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp} from "firebase/firestore";
import {hallFirestore} from "../../email-worker/src/hallFirestore.js";
import {saveHallEventSource} from "../../email-worker/src/hallEventSource.js";
import {saveHallBooking} from "../../email-worker/src/hallBookingModel.js";
const projectId = "demo-hall-events", port = Number(process.env.FIRESTORE_RULES_EMULATOR_PORT || 8080);
const runtime = {FIREBASE_PROJECT_ID: projectId, FIRESTORE_EMULATOR_HOST: `127.0.0.1:${port}`};
let env;
const id = "hall-event-test", path = `events/${id}`, date = "2026-11-05";
const data = {section: "Cubs", startDate: date, endDate: date, status: "open", title: "PRIVATE title", eventType: "Activity", leaderNotes: "PRIVATE notes", attendance: {private: "attending"}, consent: {private: "received"}, audience: {version: 3, mode: "sections", semantics: "snapshot", sectionIds: ["Cubs"], memberIds: [], resolvedMemberIds: []}, createdBy: "council"};
const sourceStore = () => hallFirestore(runtime, "owner");
const interval = {date, startTime: "19:00", endDate: date, endTime: "20:00"};
const save = (changes = {}) => saveHallEventSource(sourceStore(), "council", {id, expectedRevision: 0, expectedStartDate: date, expectedEndDate: date, interval, ...changes});
const release = (revision = 1) => saveHallEventSource(sourceStore(), "council", {id, expectedRevision: revision, expectedStartDate: date, expectedEndDate: date, release: true});
const seed = (path, value) => env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(), path), value));
async function raw(path) {let value; await env.withSecurityRulesDisabled(async ctx => {value = (await getDoc(doc(ctx.firestore(), path))).data();}); return value;}
before(async () => {env = await initializeTestEnvironment({projectId, firestore: {host: "127.0.0.1", port, rules: await readFile("firestore.rules", "utf8")}});});
after(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  for (const [fixturePath, value] of [["hall/group", {ready: true, revision: 0}], ["siteSettings/hallHire", {enabled: true}],
    ["adminUsers/council", {active: true, role: "leader", sections: ["Cubs"]}], ["organisationLeadership/council", {active: true, scoutingRole: "Section Leader", organisationSection: "Cubs"}],
    ["adminUsers/scouter", {active: true, role: "leader", sections: ["Cubs"]}], ["organisationLeadership/scouter", {active: true, scoutingRole: "Programme Scouter", organisationSection: "Cubs"}],
    ["adminUsers/admin", {active: true, role: "admin", sections: ["Cubs"]}], [path, data]]) await seed(fixturePath, value);
});
test("ordinary event/consent/status edits remain allowed while marked schedule/section/metadata bypasses fail", async () => {
  await save(); const db = env.authenticatedContext("scouter").firestore();
  await assertSucceeds(updateDoc(doc(db, path), {leaderNotes: "Scoped edit", attendance: {private: "attending"}, updatedAt: serverTimestamp(), updatedBy: "scouter"}));
  await assertSucceeds(updateDoc(doc(db, path), {status: "completed"}));
  for (const change of [{startDate: "2026-11-04"}, {endDate: "2026-11-06"}, {section: "Cub"}, {hallResource: ""}, {hallInterval: interval}, {hallRevision: 3}]) {
    // hallInterval must change value to test metadata immutability.
    if (change.hallInterval) change.hallInterval = {...interval, endTime: "21:00"};
    await assertFails(updateDoc(doc(db, path), change));
  }
  await assertFails(deleteDoc(doc(db, path)));
  await release(); await assertSucceeds(updateDoc(doc(db, path), {startDate: "2026-11-04", endDate: "2026-11-06"}));
  assert.deepEqual(await raw(`hallAvailability/${date}`), {occupied: []});
});
test("direct creates cannot manufacture hall fields; ordinary event creation remains available", async () => {
  const db = env.authenticatedContext("council").firestore();
  for (const change of [{hallResource: "group-hall"}, {hallInterval: interval}, {hallRevision: 0}]) await assertFails(setDoc(doc(db, "events/injected"), {...data, ...change}));
  await assertSucceeds(setDoc(doc(db, "events/ordinary"), data));
});
test("Council has no additional event/member read rights or unauthenticated source access", async () => {
  await seed(path, {...data, section: "Scouts"}); await assert.rejects(save(), {status: 403});
  await assertFails(getDoc(doc(env.authenticatedContext("council").firestore(), path)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), path)));
  await assertFails(getDoc(doc(env.authenticatedContext("council").firestore(), "hall/group/bookings/private")));
  assert.equal(await raw(`hallAvailability/${date}`), undefined);
});
test("event/manual concurrent submissions permit exactly one commit with neutral availability", async () => {
  const manual = {id: "manual", resourceId: "group-hall", kind: "external", state: "confirmed", interval, title: "Private", hirerName: "Private", contact: "Private", notes: "Private"};
  const results = await Promise.allSettled([save(), saveHallBooking(sourceStore(), "council", {booking: manual, expectedRevision: 0})]);
  assert.equal(results.filter(value => value.status === "fulfilled").length, 1);
  assert.equal(results.find(value => value.status === "rejected").reason.code, "hall/conflict");
  assert.equal((await raw(path)).hallResource === "group-hall", results[0].status === "fulfilled");
  const occupied = await raw(`hallAvailability/${date}`); assert.deepEqual(Object.keys(occupied), ["occupied"]); assert.deepEqual(Object.keys(occupied.occupied[0]).sort(), ["end", "start"]);
});
test("off-state move/release preserve canonical dates and protected content", async () => {
  await save(); await seed("siteSettings/hallHire", {enabled: false});
  await save({expectedRevision: 1, interval: {...interval, startTime: "20:00", endTime: "21:00"}});
  const current = await raw(path); assert.equal(current.startDate, date); assert.equal(current.leaderNotes, data.leaderNotes); assert.deepEqual(current.consent, data.consent);
  await release(2); assert.equal((await raw(path)).hallResource, undefined); assert.deepEqual(await raw(`hallAvailability/${date}`), {occupied: []});
});
test("a concurrent ordinary date edit and hall reservation cannot both commit", async () => {
  const db = env.authenticatedContext("scouter").firestore();
  const results = await Promise.allSettled([save(), updateDoc(doc(db, path), {endDate: "2026-11-06"})]);
  assert.equal(results.filter(value => value.status === "fulfilled").length, 1);
  const current = await raw(path);
  if (current.hallResource === "group-hall") {
    assert.equal(current.endDate, date); assert.equal((await raw(`hallAvailability/${date}`)).occupied.length, 1);
  } else {
    assert.equal(current.endDate, "2026-11-06"); assert.equal(await raw(`hallAvailability/${date}`), undefined);
  }
});
