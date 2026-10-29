import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, writeBatch, serverTimestamp, deleteDoc } from "firebase/firestore";
let env;
before(async () => {env = await initializeTestEnvironment({projectId: "demo-hall-rollout", firestore: {host: "127.0.0.1", port: Number(process.env.FIRESTORE_RULES_EMULATOR_PORT || 8080), rules: await readFile("firestore.rules", "utf8")}});});
after(async () => {await env.cleanup();});
async function seed(path, data) {await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), path), data));}
beforeEach(async () => {
  await env.clearFirestore();
  for (const [uid, role] of [["super", "super-admin"], ["admin", "admin"], ["council", "leader"]]) await seed(`adminUsers/${uid}`, {active: true, role, sections: ["Cubs"]});
  await seed("organisationLeadership/council", {active: true, scoutingRole: "Group Leader"});
  await seed("hall/group", {ready: true, revision: 5});
  await seed("siteSettings/hallHireReadiness", {ready: true});
  await seed("hall/group/bookings/retained", {state: "confirmed", notes: "Protected"});
  await seed("siteSettings/calendarExperience", {version: "redesigned"});
});
function change(db, enabled, uid = "super", publicEnabled = enabled) {
  const batch = writeBatch(db);
  batch.set(doc(db, "siteSettings/hallHire"), {enabled, updatedBy: uid, updatedAt: serverTimestamp()});
  batch.set(doc(db, "siteSettings/hallHirePublic"), {enabled: publicEnabled});
  return batch.commit();
}
test("only Superuser can change Hall Hire; canonical/public setting must agree and contain no extra fields", async () => {
  for (const uid of ["admin", "council", "parent"]) {
    const db = env.authenticatedContext(uid).firestore();
    await assertFails(change(db, true, uid));
    await assertFails(getDoc(doc(db, "siteSettings/hallHire")));
  }
  const db = env.authenticatedContext("super").firestore();
  await assertFails(change(db, true, "super", false));
  await assertSucceeds(change(db, true));
  await assertFails(setDoc(doc(db, "siteSettings/hallHirePublic"), {enabled: false}));
  await assertFails(setDoc(doc(db, "siteSettings/hallHirePublic"), {enabled: true, notes: "private"}));
  await assertFails(setDoc(doc(db, "siteSettings/hallHireReadiness"), {ready: true}));
  await assertFails(deleteDoc(doc(db, "siteSettings/hallHire")));
  const publicDb = env.unauthenticatedContext().firestore();
  assert.deepEqual((await assertSucceeds(getDoc(doc(publicDb, "siteSettings/hallHirePublic")))).data(), {enabled: true});
  assert.deepEqual((await assertSucceeds(getDoc(doc(publicDb, "siteSettings/hallHireReadiness")))).data(), {ready: true});
  await assertFails(getDoc(doc(publicDb, "siteSettings/hallHire")));
});
test("readiness cannot be forged; rollback remains possible after readiness is revoked and preserves records", async () => {
  const db = env.authenticatedContext("super").firestore();
  await assertSucceeds(change(db, true));
  await seed("hall/group", {ready: false, revision: 5});
  await seed("siteSettings/hallHireReadiness", {ready: false});
  await assertFails(change(db, true));
  await assertSucceeds(change(db, false));
  await env.withSecurityRulesDisabled(async context => {
    const trusted = context.firestore();
    assert.deepEqual((await getDoc(doc(trusted, "hall/group"))).data(), {ready: false, revision: 5});
    assert.equal((await getDoc(doc(trusted, "hall/group/bookings/retained"))).data().state, "confirmed");
    assert.equal((await getDoc(doc(trusted, "siteSettings/calendarExperience"))).data().version, "redesigned");
  });
  await seed("siteSettings/hallHireReadiness", {ready: true});
  await assertFails(change(db, true)); // Public readiness alone cannot override the authoritative lock.
});
