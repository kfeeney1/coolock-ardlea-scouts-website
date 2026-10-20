import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { ref, getBytes, listAll, uploadBytes } from "firebase/storage";
import { maintenanceDocumentStore } from "../../src/services/maintenanceDocumentStore.ts";
let env;
const id = "12345678-1234-1234-1234-123456789012";
const uid = "maintenance-sdk-parent";
before(async () => { env = await initializeTestEnvironment({projectId: "demo-coolock-ardlea-scouts", firestore: {host: "127.0.0.1", port: 8080, rules: await readFile("firestore.rules", "utf8")}, storage: {host: "127.0.0.1", port: 9199, rules: await readFile("storage.rules", "utf8")}}); });
after(async () => env?.cleanup());
test("direct document SDK preserves bytes, metadata, retry identity, authorization and rollback retention", async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "siteSettings/maintenanceExperience"), {version: "redesigned"});
    await setDoc(doc(db, `parentAccounts/${uid}`), {status: "approved"});
    await setDoc(doc(db, "members/sdk-linked-record"), {accountUid: "sdk-linked", status: "active"});
    await setDoc(doc(db, "adminUsers/sdk-leader"), {active: true, role: "leader", sections: ["Cubs"]});
  });
  const ctx = env.authenticatedContext(uid); const db = ctx.firestore(); const storage = ctx.storage();
  await assertSucceeds(setDoc(doc(db, `maintenance/group/access/${uid}`), {kind: "parent", sourceId: uid}));
  const store = maintenanceDocumentStore(db, storage, () => uid);
  const file = new File(["%PDF-1.4\nMaintenance synthetic bill\n%%EOF"], "Maintenance bill.pdf", {type: "application/pdf"});
  await assert.doesNotReject(store.upload(file, id), "canonical parent upload and retry must succeed");
  const first = await store.ready(id);
  assert.equal(first.fileName, file.name);
  assert.equal(first.size, file.size);
  assert.equal((await getBytes(ref(storage, `maintenance-documents/${id}`))).byteLength, file.size);
  await store.upload(file, id);
  assert.equal((await store.list()).documents.length, 1);
  await env.withSecurityRulesDisabled(async disabled => { await updateDoc(doc(disabled.firestore(), `maintenance/group/documents/${id}`), {state: "pending"}); });
  await store.upload(file, id); // Bytes retained after a failed metadata finalization.
  assert.equal((await store.list()).documents.length, 1);
  assert.equal((await store.list()).documents[0].state, "ready");
  await assert.rejects(store.upload(new File(["different"], file.name, {type: file.type}), id));
  await assertFails(updateDoc(doc(db, `maintenance/group/documents/${id}`), {fileName: "Replaced"}));
  await assertFails(uploadBytes(ref(storage, `maintenance-documents/${id}`), new Uint8Array([1]), {contentType: "application/pdf"}));
  const pendingId = "22345678-1234-1234-1234-123456789012";
  await assertSucceeds(setDoc(doc(db, `maintenance/group/documents/${pendingId}`), {fileName: file.name, contentType: file.type, size: file.size, sha256: first.sha256, uploadedBy: uid, uploadedAt: serverTimestamp(), state: "pending"}));
  await assert.rejects(store.ready(pendingId), /not ready/);
  await store.upload(file, pendingId);
  assert.equal((await store.list()).documents.length, 2);
  assert.equal((await store.ready(pendingId)).sha256, first.sha256);
  for (const [user, kind, sourceId] of [["sdk-linked", "member", "sdk-linked-record"], ["sdk-leader", "leader", "sdk-leader"]]) {
    const member = env.authenticatedContext(user);
    await assertSucceeds(setDoc(doc(member.firestore(), `maintenance/group/access/${user}`), {kind, sourceId}));
    await assertSucceeds(getDoc(doc(member.firestore(), `maintenance/group/documents/${id}`)));
    await assert.doesNotReject(getBytes(ref(member.storage(), `maintenance-documents/${id}`)), `${user} canonical Storage read`);
  }
  for (const outsider of [env.unauthenticatedContext(), env.authenticatedContext("sdk-outsider")]) {
    await assertFails(getDoc(doc(outsider.firestore(), `maintenance/group/documents/${id}`)));
    await assertFails(getDocs(collection(outsider.firestore(), "maintenance/group/documents")));
    await assertFails(getBytes(ref(outsider.storage(), `maintenance-documents/${id}`)));
    await assertFails(uploadBytes(ref(outsider.storage(), "maintenance-documents/32345678-1234-1234-1234-123456789012"), new Uint8Array([1])));
  }
  await assertFails(listAll(ref(storage, "maintenance-documents")));
  await assertFails(getDoc(doc(db, `maintenance/another-group/documents/${id}`)));
  for (const [target, contentType, size] of [["42345678-1234-1234-1234-123456789012", "text/html", 1], ["52345678-1234-1234-1234-123456789012", "application/pdf", 10 * 1024 * 1024 + 1]]) {
    await assertFails(uploadBytes(ref(storage, `maintenance-documents/${target}`), new Uint8Array(size), {contentType, customMetadata: {uploadedBy: uid, documentId: target, sha256: first.sha256}}));
  }
  await env.withSecurityRulesDisabled(async disabled => {
    await updateDoc(doc(disabled.firestore(), "parentAccounts/maintenance-sdk-parent"), {status: "pending"});
    await updateDoc(doc(disabled.firestore(), "members/sdk-linked-record"), {status: "inactive"});
    await updateDoc(doc(disabled.firestore(), "adminUsers/sdk-leader"), {active: false});
  });
  for (const revoked of [ctx, env.authenticatedContext("sdk-linked"), env.authenticatedContext("sdk-leader")]) {
    await assertFails(getDoc(doc(revoked.firestore(), `maintenance/group/documents/${id}`)));
    await assertFails(getBytes(ref(revoked.storage(), `maintenance-documents/${id}`)));
  }
  await env.withSecurityRulesDisabled(async disabled => {
    await updateDoc(doc(disabled.firestore(), "parentAccounts/maintenance-sdk-parent"), {status: "approved"});
    await setDoc(doc(disabled.firestore(), "siteSettings/maintenanceExperience"), {version: "existing"});
  });
  await assertFails(getDoc(doc(db, `maintenance/group/documents/${id}`)));
  await env.withSecurityRulesDisabled(async disabled => { await setDoc(doc(disabled.firestore(), "siteSettings/maintenanceExperience"), {version: "redesigned"}); });
  assert.equal((await store.ready(id)).sha256, first.sha256);
});
