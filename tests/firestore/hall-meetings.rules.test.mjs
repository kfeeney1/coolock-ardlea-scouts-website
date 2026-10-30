import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
import {before, beforeEach, after, test} from "node:test";
import {assertFails, assertSucceeds, initializeTestEnvironment} from "@firebase/rules-unit-testing";
import {doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch} from "firebase/firestore";
import {hallFirestore} from "../../email-worker/src/hallFirestore.js";
import {saveHallMeetingSource} from "../../email-worker/src/hallMeetingSource.js";
import {saveHallBooking} from "../../email-worker/src/hallBookingModel.js";
const projectId = "demo-hall-meetings", port = Number(process.env.FIRESTORE_RULES_EMULATOR_PORT || 8080);
const runtime = {FIREBASE_PROJECT_ID: projectId, FIRESTORE_EMULATOR_HOST: `127.0.0.1:${port}`};
let env;
const id = "hall-meeting-test", path = `weeklyMeetings/${id}`, parentPath = `parentWeeklyMeetings/${id}`, date = "2026-11-05";
const data = {section: "Cubs", meetingDate: date, status: "open", location: "PRIVATE location", plannedActivities: "PRIVATE activity", plannedBadgework: "PRIVATE badgework", programmeNotes: "PRIVATE programme", notes: "PRIVATE leader notes", entries: [], injuries: [], createdBy: "council"};
const sourceStore = () => hallFirestore(runtime, "owner");
const save = (changes = {}) => saveHallMeetingSource(sourceStore(), "council", {id, expectedRevision: 0, expectedDate: date, date, startTime: "19:00", endTime: "20:00", ...changes});
const release = (revision = 1, expectedDate = date) => saveHallMeetingSource(sourceStore(), "council", {id, expectedRevision: revision, expectedDate, release: true});
const seed = (path, value) => env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(), path), value));
async function raw(path) {let value; await env.withSecurityRulesDisabled(async ctx => {value = (await getDoc(doc(ctx.firestore(), path))).data();}); return value;}
before(async () => {env = await initializeTestEnvironment({projectId, firestore: {host: "127.0.0.1", port, rules: await readFile("firestore.rules", "utf8")}});});
after(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  for (const [fixturePath, value] of [["hall/group", {ready: true, revision: 0}], ["siteSettings/hallHire", {enabled: true}],
    ["adminUsers/council", {active: true, role: "leader", sections: ["Cubs"]}], ["organisationLeadership/council", {active: true, scoutingRole: "Section Leader", organisationSection: "Cubs"}],
    ["adminUsers/scouter", {active: true, role: "leader", sections: ["Cubs"]}], ["organisationLeadership/scouter", {active: true, scoutingRole: "Programme Scouter", organisationSection: "Cubs"}],
    ["adminUsers/admin", {active: true, role: "admin", sections: ["Cubs"]}], [path, data], [parentPath, {section: "Cubs", meetingDate: date, status: "open", location: "Published den", theme: "Published theme", activities: [], badgework: []}]]) await seed(fixturePath, value);
});
test("ordinary section programme edits/closure/reopen remain allowed, but hall date/metadata tampering is denied", async () => {
  await save(); const client = env.authenticatedContext("scouter").firestore();
  await assertSucceeds(updateDoc(doc(client, path), {notes: "Ordinary scoped programme update", updatedBy: "scouter", updatedAt: serverTimestamp()}));
  await assertSucceeds(updateDoc(doc(client, path), {status: "closed", updatedBy: "scouter", updatedAt: serverTimestamp()}));
  await assertSucceeds(updateDoc(doc(client, path), {status: "open", updatedBy: "scouter", updatedAt: serverTimestamp()}));
  for (const change of [{meetingDate: "2026-11-06"}, {hallResource: ""}, {hallStartTime: "18:00"}, {hallRevision: 2}]) await assertFails(updateDoc(doc(client, path), {...change, updatedBy: "scouter", updatedAt: serverTimestamp()}));
  await assertFails(updateDoc(doc(client, parentPath), {meetingDate: "2026-11-06"}));
  assert.equal((await raw(`hallAvailability/${date}`)).occupied.length, 1);
});
test("marked closed sources and parent projections cannot be deleted before explicit release", async () => {
  await save(); await seed(path, {...await raw(path), status: "closed"}); await seed(parentPath, {...await raw(parentPath), status: "closed"});
  const db = env.authenticatedContext("admin").firestore();
  await assertFails(deleteDoc(doc(db, path))); await assertFails(deleteDoc(doc(db, parentPath)));
  await release(); const batch = writeBatch(db); batch.delete(doc(db, path)); batch.delete(doc(db, parentPath)); await assertSucceeds(batch.commit());
  assert.deepEqual(await raw(`hallAvailability/${date}`), {occupied: []});
});
test("Council booking access never grants another section's meeting read/write access", async () => {
  await seed(path, {...data, section: "Scouts"});
  await assert.rejects(save(), {status: 403});
  await assertFails(getDoc(doc(env.authenticatedContext("council").firestore(), path)));
  await assert.rejects(saveHallMeetingSource(sourceStore(), "scouter", {id, expectedRevision: 0, expectedDate: date, date, startTime: "19:00", endTime: "20:00"}), {status: 403});
  assert.equal(await raw(`hallAvailability/${date}`), undefined);
});
test("meeting/manual concurrent submissions allow exactly one commit; losing source is unchanged", async () => {
  const manual = {id: "manual", resourceId: "group-hall", kind: "blocked", state: "confirmed", interval: {date, startTime: "19:00", endDate: date, endTime: "20:00"}, title: "Private", hirerName: "", contact: "", notes: ""};
  const results = await Promise.allSettled([save(), saveHallBooking(sourceStore(), "council", {booking: manual, expectedRevision: 0})]);
  assert.equal(results.filter(value => value.status === "fulfilled").length, 1);
  assert.equal(results.find(value => value.status === "rejected").reason.code, "hall/conflict");
  assert.equal((await raw(path)).hallResource === "group-hall", results[0].status === "fulfilled");
  assert.equal((await raw("hall/group")).revision, 1);
});
test("date moves update canonical and parent programme atomically; off-state release retains private source", async () => {
  await save(); await seed("siteSettings/hallHire", {enabled: false});
  await save({expectedRevision: 1, date: "2026-11-06"});
  assert.equal((await raw(path)).meetingDate, "2026-11-06"); assert.equal((await raw(parentPath)).meetingDate, "2026-11-06");
  assert.equal((await raw(path)).programmeNotes, data.programmeNotes); assert.deepEqual(await raw(`hallAvailability/${date}`), {occupied: []});
  await release(2, "2026-11-06"); assert.equal((await raw(path)).hallResource, undefined);
  assert.equal((await raw(path)).notes, data.notes); assert.deepEqual(await raw("hallAvailability/2026-11-06"), {occupied: []});
});
