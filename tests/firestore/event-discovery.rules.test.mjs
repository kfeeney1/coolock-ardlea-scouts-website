import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, collection, writeBatch, serverTimestamp } from "firebase/firestore";
import { discoverEventDocuments } from "../../email-worker/src/eventDiscovery.js";

const projectId = "demo-coolock-ardlea-scouts";
let env;
const base = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents`;
function token(uid) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({alg: "none", typ: "JWT"})}.${encode({sub: uid, user_id: uid, aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
    firebase: {sign_in_provider: "custom"}})}.`;
}
async function discover(uid, collection, filters = []) {
  const request = new Request("https://worker.test/event-audience-save", {headers: uid ? {Authorization: `Bearer ${token(uid)}`} : {}});
  const response = await discoverEventDocuments(request, {collection, filters}, {base, serviceToken: async () => "owner"});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  return (await response.json()).paths.sort();
}
async function seed(records) {
  await env.withSecurityRulesDisabled(async ctx => {
    for (const [path, data] of records) await setDoc(doc(ctx.firestore(), path), data);
  });
}
const projection = id => ({eventId: id, title: id, description: "", section: "Cubs", eventType: "Camp",
  location: "Den", startDate: "2099-01-01", endDate: "2099-01-02", status: "open"});
before(async () => {
  env = await initializeTestEnvironment({projectId, firestore: {host: "127.0.0.1", port: 8080, rules: await readFile("firestore.rules", "utf8")}});
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed([
    ["adminUsers/super", {active: true, role: "super-admin", sections: ["Group"]}],
    ["adminUsers/admin", {active: true, role: "admin", sections: ["Group"]}],
    ["adminUsers/cubs", {active: true, role: "leader", sections: ["Cubs"]}],
    ["parentAccounts/parent", {status: "approved", memberIds: ["child"]}],
    ["parentAccounts/other", {status: "approved", memberIds: ["other-child"]}],
    ["members/child", {status: "active", section: "Cubs"}],
    ["members/other-child", {status: "active", section: "Scouts"}],
    ...["visible", "legacy", "hidden"].flatMap(id => {
      const safe = projection(id), {status, ...publicData} = safe;
      return [
        [`events/${id}`, {...safe, ...(id === "legacy" ? {} : {hidden: id === "hidden"}), leaderNotes: "private", attendance: {child: "attending"}}],
        [`publicEvents/${id}`, publicData],
        [`parentGalleryEvents/${id}`, safe],
        [`auditLog/${id}`, {category: "event", targetId: id, targetLabel: id}],
        [`eventConsentResponses/${id}`, {eventId: id, childName: "Private child"}],
        [`eventConsentLinks/${id}`, {...safe, active: true, audienceVersion: 3, audienceMemberIds: []}],
        [`events/${id}/audienceMembers/child`, {eventId: id, memberId: "child", startDate: safe.startDate}]
      ];
    }),
    ["events/scouts", {...projection("scouts"), section: "Scouts"}],
    // Legacy links remain discoverable even without public schedule projections.
    ["events/unprojected", projection("unprojected")],
    ["eventConsentLinks/unprojected", {...projection("unprojected"), active: true, audienceVersion: 2, audienceMemberIds: ["child"]}],
  ]);
});
after(async () => env.cleanup());

test("visible discovery preserves legacy records and excludes hidden sources from every role boundary", async () => {
  assert.deepEqual(await discover("cubs", "events"), ["events/legacy", "events/unprojected", "events/visible"]);
  assert.deepEqual(await discover("admin", "events"), ["events/legacy", "events/scouts", "events/unprojected", "events/visible"]);
  assert.equal((await discover("super", "events")).includes("events/hidden"), true);
  assert.deepEqual(await discover("parent", "events"), []);
  assert.deepEqual(await discover("admin", "auditLog"), ["auditLog/legacy", "auditLog/visible"]);
  assert.deepEqual(await discover("admin", "eventConsentResponses"), ["eventConsentResponses/legacy", "eventConsentResponses/visible"]);
  assert.deepEqual(await discover("parent", "eventConsentResponses"), []);
  assert.deepEqual(await discover(null, "publicEvents"), ["publicEvents/legacy", "publicEvents/visible"]);
  assert.deepEqual(await discover("parent", "parentGalleryEvents"), ["parentGalleryEvents/legacy", "parentGalleryEvents/visible"]);
  assert.deepEqual(await discover("parent", "audienceMembers", [["memberId", "==", "child"]]),
    ["events/legacy/audienceMembers/child", "events/visible/audienceMembers/child"]);
  assert.deepEqual(await discover("other", "audienceMembers", [["memberId", "==", "child"]]), []);
  assert.deepEqual(await discover("parent", "eventConsentLinks"), ["eventConsentLinks/legacy", "eventConsentLinks/unprojected", "eventConsentLinks/visible"]);
  assert.deepEqual(await discover("other", "eventConsentLinks"), []);
});

test("hide and restore remove all existing projections while preserving records and immutable audit", async () => {
  const db = env.authenticatedContext("super").firestore();
  const original = (await getDoc(doc(db, "events/visible"))).data();
  const toggle = async (hidden, id) => {
    const batch = writeBatch(db);
    batch.update(doc(db, "events/visible"), {hidden, visibilityChangeId: id, updatedBy: "super", updatedAt: serverTimestamp()});
    batch.set(doc(db, "events/visible/visibilityHistory", id), {fromHidden: !hidden, toHidden: hidden, actorUid: "super", changedAt: serverTimestamp()});
    await assertSucceeds(batch.commit());
  };
  await toggle(true, "hide");
  for (const collection of ["publicEvents", "parentGalleryEvents", "eventConsentLinks"]) {
    assert.equal((await discover("parent", collection)).some(path => path.endsWith("/visible")), false);
    await assertFails(getDoc(doc(env.authenticatedContext("parent").firestore(), collection, "visible")));
  }
  assert.equal((await discover("parent", "audienceMembers")).some(path => path.includes("/visible/")), false);
  await toggle(false, "restore");
  for (const collection of ["publicEvents", "parentGalleryEvents", "eventConsentLinks"]) {
    assert.equal((await discover("parent", collection)).some(path => path.endsWith("/visible")), true);
  }
  const restored = (await getDoc(doc(db, "events/visible"))).data();
  for (const [key, value] of Object.entries(original)) assert.deepEqual(restored[key], value);
  assert.equal((await getDocs(collection(db, "events/visible/visibilityHistory"))).size, 2);
});

test("discovery rejects arbitrary collections, invalid filters, anonymous private scans and forged tokens", async () => {
  const call = (body, authorization) => discoverEventDocuments(new Request("https://worker.test", {headers: authorization ? {Authorization: authorization} : {}}), body, {base, serviceToken: async () => "owner"});
  assert.equal((await call({collection: "members", filters: []})).status, 400);
  assert.equal((await call({collection: "events", filters: [["leaderNotes", "==", "private"]]})).status, 400);
  assert.equal((await call({collection: "events", filters: []})).status, 401);
  assert.equal((await call({collection: "events", filters: []}, "Bearer invalid")).status, 401);
});
