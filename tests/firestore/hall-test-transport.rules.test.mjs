import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
import {before, beforeEach, after, test} from "node:test";
import {assertFails, assertSucceeds, initializeTestEnvironment} from "@firebase/rules-unit-testing";
import {createMockUserToken} from "@firebase/util";
import {doc, getDoc, setDoc} from "firebase/firestore";
import {handleTestHallRequest, hallTestProject} from "../../email-worker/src/testHallEntry.js";
// Exact TEST audience is exercised only against explicit loopback emulation.
// No service credentials, OAuth request or live Firebase request is used.
const projectId = hallTestProject, port = Number(process.env.FIRESTORE_RULES_EMULATOR_PORT || 8080);
const runtime = {FIREBASE_PROJECT_ID: projectId, FIREBASE_SERVICE_ACCOUNT_EMAIL: `synthetic@${projectId}.iam.gserviceaccount.com`, FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: "synthetic-only", HALL_BUILD_COMMIT: "a".repeat(40)};
let env;
const date = "2026-11-05", origin = `https://${projectId}.web.app`;
const booking = (changes = {}) => ({id: "transport", resourceId: "group-hall", kind: "external", state: "confirmed", title: "PRIVATE PURPOSE", hirerName: "PRIVATE HIRER", contact: "private@example.com", notes: "PRIVATE NOTES", interval: {date, startTime: "19:00", endDate: date, endTime: "20:00"}, ...changes});
const seed = (path, value) => env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(), path), value));
async function raw(path) {let value; await env.withSecurityRulesDisabled(async ctx => {value = (await getDoc(doc(ctx.firestore(), path))).data();}); return value;}
async function emulatorFetch(input, options) {
  const url = new URL(input);
  assert.equal(url.origin, "https://firestore.googleapis.com");
  assert.ok(url.pathname.startsWith(`/v1/projects/${projectId}/databases/(default)/documents`));
  return fetch(`http://127.0.0.1:${port}${url.pathname}${url.search}`, {...options, redirect: "error"});
}
function request(uid, body, changes = {}) {
  const token = createMockUserToken({sub: uid}, projectId);
  return handleTestHallRequest(new Request("https://worker.invalid/hall-bookings", {method: "POST", headers: {Origin: origin, Authorization: `Bearer ${token}`, ...changes}, body: JSON.stringify(body)}), runtime, async () => "owner", emulatorFetch);
}
before(async () => {env = await initializeTestEnvironment({projectId, firestore: {host: "127.0.0.1", port, rules: await readFile("firestore.rules", "utf8")}});});
after(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  for (const [path, value] of [["hall/group", {ready: true, revision: 0}], ["siteSettings/hallHire", {enabled: true}],
    ["adminUsers/council", {active: true, role: "leader", sections: ["Cubs"]}], ["organisationLeadership/council", {active: true, scoutingRole: "Section Leader", organisationSection: "Cubs"}],
    ["adminUsers/scouter", {active: true, role: "leader", sections: ["Cubs"]}], ["organisationLeadership/scouter", {active: true, scoutingRole: "Scouter", organisationSection: "Cubs"}],
    ["weeklyMeetings/private-scouts", {section: "Scouts", meetingDate: date, status: "open", notes: "PRIVATE PROGRAMME"}]]) await seed(path, value);
});
test("isolated TEST entry uses the actual transactional handler for create/read/reschedule/cancel and immutable history", async () => {
  const save = (value, revision) => request("council", {action: "save", command: {booking: value, expectedRevision: revision}});
  assert.equal((await save(booking(), 0)).status, 200);
  const get = await request("council", {action: "get", id: "transport"}); assert.equal(get.status, 200); assert.equal((await get.json()).item.title, "PRIVATE PURPOSE");
  assert.equal((await request("council", {action: "list"})).status, 200);
  const moved = booking({interval: {date, startTime: "20:00", endDate: date, endTime: "21:00"}});
  assert.equal((await save(moved, 1)).status, 200);
  const publicRef = doc(env.unauthenticatedContext().firestore(), `hallAvailability/${date}`);
  assert.deepEqual((await assertSucceeds(getDoc(publicRef))).data(), {occupied: [{start: `${date}T20:00:00.000Z`, end: `${date}T21:00:00.000Z`}]});
  await assertFails(getDoc(doc(env.authenticatedContext("council").firestore(), "hall/group/bookings/transport")));
  assert.equal((await save({...moved, state: "cancelled"}, 2)).status, 200);
  assert.deepEqual((await getDoc(publicRef)).data(), {occupied: []});
  const history = await request("council", {action: "history", id: "transport"}); assert.equal(history.status, 200); assert.equal((await history.json()).items.length, 3);
  assert.equal((await raw("auditLog/hall-transport-3")).actorUid, "council");
});
test("isolated transport preserves Council checks, canonical source scope and disabled-state records", async () => {
  assert.equal((await request("scouter", {action: "list"})).status, 403);
  assert.equal((await request("council", {action: "meeting-hall", command: {id: "private-scouts", expectedRevision: 0, expectedDate: date, date, startTime: "18:00", endTime: "19:00"}})).status, 403);
  assert.equal((await raw("weeklyMeetings/private-scouts")).notes, "PRIVATE PROGRAMME");
  assert.equal((await request("council", {action: "save", command: {booking: booking(), expectedRevision: 0}})).status, 200);
  await seed("siteSettings/hallHire", {enabled: false});
  assert.equal((await request("council", {action: "list"})).status, 409);
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `hallAvailability/${date}`)));
  assert.equal((await raw("hall/group/bookings/transport")).revision, 1);
});
