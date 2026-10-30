import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { createMockUserToken } from "@firebase/util";
import { collection, doc, getDoc, getDocs, limit, query, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { hallFirestore } from "../../email-worker/src/hallFirestore.js";
import { hallSourceIdentity, saveSourceHallReservation } from "../../email-worker/src/hallSourceReservation.js";
import { saveHallBooking } from "../../email-worker/src/hallBookingModel.js";
import { handleHallBookingRoute } from "../../email-worker/src/hallBookingRoutes.js";

const projectId = "demo-coolock-ardlea-scouts", host = `127.0.0.1:${process.env.FIRESTORE_RULES_EMULATOR_PORT || 8080}`;
const runtime = {FIREBASE_PROJECT_ID: projectId, FIRESTORE_EMULATOR_HOST: host, ALLOWED_ORIGINS: "https://hall.test"};
let env;
const booking = (id = "one", changes = {}) => ({id, resourceId: "group-hall", kind: "external", state: "confirmed", title: "PRIVATE TITLE", hirerName: "PRIVATE HIRER", contact: "private@example.com", notes: "PRIVATE NOTES", interval: {date: "2026-10-29", startTime: "19:00", endDate: "2026-10-29", endTime: "20:00"}, ...changes});
const save = (value, revision = 0) => saveHallBooking(hallFirestore(runtime, "owner"), "council", {booking: value, expectedRevision: revision});
async function seed(path, value) { await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), path), value)); }
async function raw(path) { let value; await env.withSecurityRulesDisabled(async context => { value = (await getDoc(doc(context.firestore(), path))).data(); }); return value; }
before(async () => { env = await initializeTestEnvironment({projectId, firestore: {host: "127.0.0.1", port: Number(host.split(":")[1]), rules: await readFile("firestore.rules", "utf8")}}); });
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  for (const [path, value] of [["hall/group", {ready: true, revision: 0}], ["siteSettings/hallHire", {enabled: true}], ["adminUsers/council", {active: true, role: "leader", sections: ["Cubs"]}], ["organisationLeadership/council", {active: true, scoutingRole: "Section Leader", organisationSection: "Cubs"}], ["adminUsers/scouter", {active: true, role: "leader", sections: ["Cubs"]}], ["organisationLeadership/scouter", {active: true, scoutingRole: "Scouter", organisationSection: "Cubs"}], ["members/scouts-private", {section: "Scouts", sections: ["Scouts"], status: "active"}]]) await seed(path, value);
});

test("anonymous availability is neutral; no client including Council can access private hall data or write projections", async () => {
  await save(booking());
  const db = env.unauthenticatedContext().firestore();
  const result = await assertSucceeds(getDoc(doc(db, "hallAvailability/2026-10-29")));
  assert.deepEqual(result.data(), {occupied: [{start: "2026-10-29T19:00:00.000Z", end: "2026-10-29T20:00:00.000Z"}]});
  await assertSucceeds(getDocs(query(collection(db, "hallAvailability"), limit(31))));
  await assertFails(getDocs(collection(db, "hallAvailability")));
  for (const context of [env.unauthenticatedContext(), env.authenticatedContext("council"), env.authenticatedContext("scouter"), env.authenticatedContext("parent")]) {
    const client = context.firestore();
    for (const path of ["hall/group", "hall/group/bookings/one", "hall/group/days/2026-10-29", "hall/group/bookings/one/history/1"]) {
      await assertFails(getDoc(doc(client, path)));
      await assertFails(setDoc(doc(client, path), {ready: true}));
      await assertFails(deleteDoc(doc(client, path)));
    }
    await assertFails(updateDoc(doc(client, "hallAvailability/2026-10-29"), {occupied: []}));
    await assertFails(getDoc(doc(client, "members/scouts-private")));
  }
});

test("two real concurrent transactions cannot both reserve the same slot; adjacent slot succeeds", async () => {
  const results = await Promise.allSettled([save(booking("race-one")), save(booking("race-two"))]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const failed = results.find(result => result.status === "rejected");
  assert.equal(failed.reason.status, 409);
  assert.equal((await raw("hallAvailability/2026-10-29")).occupied.length, 1);
  assert.equal((await raw("hall/group")).revision, 1);
  await save(booking("adjacent", {interval: {...booking().interval, startTime: "20:00", endTime: "21:00"}}));
  assert.equal((await raw("hallAvailability/2026-10-29")).occupied.length, 2);
});

test("audit create failure aborts every booking and occupancy write", async () => {
  await seed("auditLog/hall-one-1", {preexisting: true});
  await assert.rejects(save(booking()), error => error.status === 409);
  assert.equal(await raw("hall/group/bookings/one"), undefined);
  assert.equal(await raw("hallAvailability/2026-10-29"), undefined);
  assert.equal((await raw("hall/group")).revision, 0);
});

test("rollout off and readiness off deny public reads without deleting records", async () => {
  await save(booking());
  const publicRef = doc(env.unauthenticatedContext().firestore(), "hallAvailability/2026-10-29");
  await seed("siteSettings/hallHire", {enabled: false});
  await assertFails(getDoc(publicRef));
  await assert.rejects(save(booking("two")), {code: "hall/disabled"});
  await seed("siteSettings/hallHire", {enabled: true}); await seed("hall/group", {ready: false});
  await assertFails(getDoc(publicRef));
  assert.equal((await raw("hall/group/bookings/one")).revision, 1);
});

test("existing Worker route validates identity, Council scope, private reads and revocation", async () => {
  async function request(uid, body) {
    const token = createMockUserToken({sub: uid}, projectId);
    return handleHallBookingRoute(new Request("https://worker.test/hall-bookings", {method: "POST", headers: {Origin: "https://hall.test", Authorization: `Bearer ${token}`}, body: JSON.stringify(body)}), runtime, async () => "owner");
  }
  assert.equal((await request("council", {action: "save", command: {booking: booking(), expectedRevision: 0}})).status, 200);
  const list = await request("council", {action: "list"}); assert.equal(list.status, 200);
  const single = await request("council", {action: "get", id: "one"}); assert.equal(single.status, 200);
  assert.equal((await single.json()).item.title, "PRIVATE TITLE");
  assert.equal((await request("scouter", {action: "get", id: "one"})).status, 403);
  assert.equal((await list.json()).items[0].value.title, "PRIVATE TITLE");
  const history = await request("council", {action: "history", id: "one"}); assert.equal(history.status, 200);
  assert.equal((await history.json()).items[0].value.actorUid, "council");
  assert.equal((await request("scouter", {action: "list"})).status, 403);
  await seed("organisationLeadership/council", {active: false, scoutingRole: "Section Leader"});
  assert.equal((await request("council", {action: "list"})).status, 403);
  assert.equal((await request("council", {action: "save", command: {booking: booking(), expectedRevision: 1}})).status, 403);
});


// Trusted adapter stand-in: production source adapters must enforce their own
// canonical programme/maintenance permissions and revisions in prepare.
const sourceSave = (id, occupancy, remove = false) => saveSourceHallReservation(hallFirestore(runtime, "owner"), "council", "event", id, async (tx, {path, current}) => {
  const [profile] = await tx.read(["adminUsers/council"]);
  return {authorised: profile?.active === true, occupancy,
    persist: () => remove ? tx.delete(path) : tx.set(path, {revision: (current?.revision ?? 0) + 1, privateProgramme: "PRIVATE PROGRAMME"})};
});
const sourceOccupancy = () => ({resourceId: "group-hall", kind: "internal", state: "confirmed", interval: booking().interval});
test("real source/manual concurrent writes share one conflict lock and cannot both commit", async () => {
  const results = await Promise.allSettled([sourceSave("source-race", sourceOccupancy()), save(booking("manual-race"))]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(results.find(result => result.status === "rejected").reason.code, "hall/conflict");
  assert.equal((await raw("hall/group")).revision, 1);
  assert.equal((await raw("hallAvailability/2026-10-29")).occupied.length, 1);
  const sourceWon = results[0].status === "fulfilled";
  assert.equal(Boolean(await raw("events/source-race")), sourceWon);
  assert.equal(Boolean(await raw("hall/group/bookings/manual-race")), !sourceWon);
});
test("source deletion releases occupancy atomically while rollout and readiness are off", async () => {
  await seed("siteSettings/hallHire", {enabled: false}); await seed("hall/group", {ready: false, revision: 0});
  await sourceSave("remove-source", sourceOccupancy());
  const {bookingId} = await hallSourceIdentity("event", "remove-source");
  assert.equal(JSON.stringify(await raw(`hall/group/bookings/${bookingId}`)).includes("PRIVATE PROGRAMME"), false);
  await sourceSave("remove-source", null, true);
  assert.equal(await raw("events/remove-source"), undefined);
  assert.equal((await raw(`hall/group/bookings/${bookingId}`)).state, "cancelled");
  assert.deepEqual(await raw("hallAvailability/2026-10-29"), {occupied: []});
  assert.equal((await raw(`hall/group/bookings/${bookingId}/history/2`)).previous.state, "confirmed");
});
test("failed source audit precondition leaves canonical source and projection unmodified", async () => {
  const {bookingId} = await hallSourceIdentity("event", "audit-source");
  await seed(`auditLog/hall-${bookingId}-1`, {preexisting: true});
  await assert.rejects(sourceSave("audit-source", sourceOccupancy()), {status: 409});
  assert.equal(await raw("events/audit-source"), undefined);
  assert.equal(await raw(`hall/group/bookings/${bookingId}`), undefined);
  assert.equal(await raw("hallAvailability/2026-10-29"), undefined);
});
