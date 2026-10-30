import {createMockUserToken} from "@firebase/util";
import {handleHallBookingRoute} from "../../email-worker/src/hallBookingRoutes.js";
import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
import {before, beforeEach, after, test} from "node:test";
import {assertFails, assertSucceeds, initializeTestEnvironment} from "@firebase/rules-unit-testing";
import {doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp} from "firebase/firestore";
import {hallFirestore} from "../../email-worker/src/hallFirestore.js";
import {saveHallMaintenanceSource} from "../../email-worker/src/hallMaintenanceSource.js";
import {saveHallBooking} from "../../email-worker/src/hallBookingModel.js";
const projectId = "demo-hall-maintenance", port = Number(process.env.FIRESTORE_RULES_EMULATOR_PORT || 8080);
const runtime = {FIREBASE_PROJECT_ID: projectId, FIRESTORE_EMULATOR_HOST: `127.0.0.1:${port}`};
let env;
const id = "maintenance-appointment-001", path = `maintenance/group/appointments/${id}`;
const input = (changes = {}) => ({title: "PRIVATE service", date: "2026-10-30", allDay: false, startTime: "19:00", endTime: "20:00", location: "PRIVATE place", notes: "PRIVATE notes", hallResource: "group-hall", ...changes});
const store = () => hallFirestore(runtime, "owner");
const save = (values = input(), revision = 0, changes = {}) => saveHallMaintenanceSource(store(), "council", {id, input: values, expectedRevision: revision, ...changes});
const seed = (path, data) => env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), path), data));
async function raw(path) {let data; await env.withSecurityRulesDisabled(async context => {data = (await getDoc(doc(context.firestore(), path))).data();}); return data;}
before(async () => {env = await initializeTestEnvironment({projectId, firestore: {host: "127.0.0.1", port, rules: await readFile("firestore.rules", "utf8")}});});
after(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  for (const [path, value] of [["hall/group", {ready: true, revision: 0}], ["siteSettings/hallHire", {enabled: true}],
    ["adminUsers/council", {active: true, role: "leader", sections: ["Cubs"]}], ["organisationLeadership/council", {active: true, scoutingRole: "Section Leader", organisationSection: "Cubs"}],
    ["siteSettings/maintenanceExperience", {version: "redesigned", sdkRevision: 1}], ["siteSettings/calendarExperience", {version: "redesigned"}],
    ["maintenance/group/access/council", {kind: "leader", sourceId: "council"}], ["parentAccounts/parent", {status: "approved"}], ["maintenance/group/access/parent", {kind: "parent", sourceId: "parent"}]]) await seed(path, value);
});
test("hall maintenance cannot be forged, rescheduled, stripped of resource or deleted via direct SDK", async () => {
  for (const uid of ["council", "parent"]) await assertFails(setDoc(doc(env.authenticatedContext(uid).firestore(), path), {...input(), revision: 1, createdBy: uid, updatedBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp()}));
  await save();
  for (const uid of ["council", "parent"]) {
    const ref = doc(env.authenticatedContext(uid).firestore(), path);
    await assertSucceeds(getDoc(ref));
    await assertFails(updateDoc(ref, {date: "2026-10-31", revision: 2, updatedBy: uid, updatedAt: serverTimestamp()}));
    await assertFails(setDoc(ref, {...input({hallResource: ""}), revision: 2, createdBy: "council", createdAt: (await raw(path)).createdAt, updatedBy: uid, updatedAt: serverTimestamp()}));
    await assertFails(deleteDoc(ref));
  }
});
test("ordinary non-hall parent scheduling remains authorised and location text never reserves the hall", async () => {
  const client = env.authenticatedContext("parent").firestore(), ref = doc(client, path);
  const {hallResource: _, ...values} = input({location: "Group hall"});
  await assertSucceeds(setDoc(ref, {...values, revision: 1, createdBy: "parent", updatedBy: "parent", createdAt: serverTimestamp(), updatedAt: serverTimestamp()}));
  await assertSucceeds(updateDoc(ref, {date: "2026-10-31", revision: 2, updatedBy: "parent", updatedAt: serverTimestamp()}));
  assert.equal(await raw("hallAvailability/2026-10-30"), undefined);
});
test("maintenance/manual concurrent writes cannot both commit; losing canonical write is rolled back", async () => {
  const results = await Promise.allSettled([save(), saveHallBooking(store(), "council", {expectedRevision: 0, booking: {id: "manual", resourceId: "group-hall", state: "confirmed", kind: "internal", interval: {date: "2026-10-30", startTime: "19:00", endDate: "2026-10-30", endTime: "20:00"}, title: "PRIVATE", hirerName: "", contact: "", notes: ""}})]);
  assert.equal(results.filter(item => item.status === "fulfilled").length, 1);
  assert.equal(results.find(item => item.status === "rejected").reason.code, "hall/conflict");
  assert.equal(Boolean(await raw(path)), results[0].status === "fulfilled");
  assert.equal((await raw("hall/group")).revision, 1);
});
test("off-state maintenance conflict remains authoritative; cancellation releases time and preserves source", async () => {
  await save(); await seed("siteSettings/hallHire", {enabled: false});
  await save(input({endTime: "21:00"}), 1);
  await assert.rejects(save(input(), 0, {id: "another-appointment-001"}), {code: "hall/disabled"});
  await saveHallMaintenanceSource(store(), "council", {id, expectedRevision: 2}, {cancel: true});
  assert.equal((await raw(path)).cancelled, true);
  assert.deepEqual(await raw("hallAvailability/2026-10-30"), {occupied: []});
  const client = env.authenticatedContext("council").firestore();
  await assertFails(updateDoc(doc(client, path), {cancelled: false}));
});
test("revocation and missing canonical access reject source changes without touching availability", async () => {
  await save(); await seed("organisationLeadership/council", {active: true, scoutingRole: "Programme Scouter", organisationSection: "Cubs"});
  await assert.rejects(save(input({date: "2026-11-01"}), 1), {status: 403});
  assert.equal((await raw(path)).revision, 1);
  assert.equal((await raw("hallAvailability/2026-10-30")).occupied.length, 1);
  assert.equal(await raw("hallAvailability/2026-11-01"), undefined);
});

test("existing Worker action verifies real identity before maintenance save and cancellation", async () => {
  const token = createMockUserToken({sub: "council"}, projectId);
  const request = (action, command, auth = token) => handleHallBookingRoute(new Request("https://worker.test/hall-bookings", {method: "POST", headers: {Origin: "https://hall.test", Authorization: auth ? `Bearer ${auth}` : ""}, body: JSON.stringify({action, command})}), {...runtime, ALLOWED_ORIGINS: "https://hall.test"}, async () => "owner");
  assert.equal((await request("maintenance-save", {id, input: input(), expectedRevision: 0}, "")).status, 401);
  assert.equal(await raw(path), undefined);
  const created = await request("maintenance-save", {id, input: input(), expectedRevision: 0});
  assert.equal(created.status, 200); assert.deepEqual(await created.json(), {ok: true, id, revision: 1});
  const cancelled = await request("maintenance-cancel", {id, expectedRevision: 1});
  assert.equal(cancelled.status, 200); assert.equal((await raw(path)).cancelled, true);
});
