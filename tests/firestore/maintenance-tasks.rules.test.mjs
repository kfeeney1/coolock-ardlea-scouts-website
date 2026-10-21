import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { maintenanceTaskStore } from "../../src/services/maintenanceTaskStore.ts";
let env;
const uid = "maintenance-task-parent";
const taskId = "12345678-1234-1234-1234-123456789012";
const documentId = "22345678-1234-1234-1234-123456789012";
before(async () => { env = await initializeTestEnvironment({projectId: "demo-coolock-ardlea-scouts", firestore: {host: "127.0.0.1", port: 8080, rules: await readFile("firestore.rules", "utf8")}}); });
after(async () => env?.cleanup());
test("direct task transactions preserve independent tasks, links, idempotency and group authorization", async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), "siteSettings/maintenanceExperience"), {version: "redesigned"});
    await setDoc(doc(ctx.firestore(), `parentAccounts/${uid}`), {status: "approved"});
    await setDoc(doc(ctx.firestore(), `maintenance/group/documents/${documentId}`), {state: "ready"});
    for (let i = 0; i < 5; i++) await setDoc(doc(ctx.firestore(), `maintenance/group/documents/linked-document-reference-${i}`), {state: "ready"});
  });
  const db = env.authenticatedContext(uid).firestore();
  await assertSucceeds(setDoc(doc(db, `maintenance/group/access/${uid}`), {kind: "parent", sourceId: uid}));
  const tasks = maintenanceTaskStore(db, () => uid);
  await tasks({action: "create", id: taskId, description: " Fix the cooker ", documentIds: []});
  const first = (await tasks({action: "get", id: taskId})).task;
  assert.equal(first.description, "Fix the cooker"); assert.equal(first.status, "open"); assert.equal(first.revision, 1);
  assert.deepEqual(first.documentIds, []);
  await tasks({action: "create", id: taskId, description: "Fix the cooker", documentIds: []});
  assert.equal((await tasks({action: "list"})).tasks.length, 1);
  const linkedTask = "32345678-1234-1234-1234-123456789012";
  await tasks({action: "create", id: linkedTask, description: "Repair roof", documentIds: [documentId]});
  assert.deepEqual((await maintenanceTaskStore(db, () => uid)({action: "get", id: linkedTask})).task.documentIds, [documentId]);
  const maximumLinks = Array.from({length: 5}, (_, i) => `linked-document-reference-${i}`);
  await tasks({action: "create", id: "62345678-1234-1234-1234-123456789012", description: "Five supported bills", documentIds: maximumLinks});
  await assert.rejects(tasks({action: "create", id: taskId, description: "Overwrite", documentIds: []}), /already in use/);
  await assert.rejects(tasks({action: "create", id: "42345678-1234-1234-1234-123456789012", description: "Bad links", documentIds: [taskId]}), /not ready/);
  const payload = {description: "Direct task", documentIds: [], status: "open", assigneeUid: "", assigneeName: "Assignment pending", revision: 1, createdBy: uid, updatedBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp()};
  const direct = doc(db, "maintenance/group/tasks/52345678-1234-1234-1234-123456789012");
  for (const patch of [{description: " \n\t "}, {description: "x".repeat(8001)}, {status: "complete"}, {assigneeUid: "arbitrary-leader"}, {createdBy: "another-user"}, {documentIds: [documentId, documentId]}, {documentIds: [...maximumLinks, documentId]}, {documentIds: [taskId]}, {unexpected: true}]) await assertFails(setDoc(direct, {...payload, ...patch}));
  await assertSucceeds(setDoc(direct, payload));
  await assertFails(updateDoc(direct, {status: "complete"}));
  for (const outsider of [env.unauthenticatedContext(), env.authenticatedContext("task-outsider")]) {
    await assertFails(getDoc(doc(outsider.firestore(), `maintenance/group/tasks/${taskId}`)));
    await assertFails(getDocs(collection(outsider.firestore(), "maintenance/group/tasks")));
    await assertFails(setDoc(doc(outsider.firestore(), `maintenance/group/tasks/${taskId}`), payload));
  }
  await assertFails(getDoc(doc(db, `maintenance/other-group/tasks/${taskId}`)));
  await env.withSecurityRulesDisabled(async ctx => { await updateDoc(doc(ctx.firestore(), `parentAccounts/${uid}`), {status: "pending"}); });
  await assertFails(getDoc(doc(db, `maintenance/group/tasks/${taskId}`)));
  await env.withSecurityRulesDisabled(async ctx => {
    await updateDoc(doc(ctx.firestore(), `parentAccounts/${uid}`), {status: "approved"});
    await setDoc(doc(ctx.firestore(), "siteSettings/maintenanceExperience"), {version: "existing"});
  });
  await assertFails(getDoc(doc(db, `maintenance/group/tasks/${taskId}`)));
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), "siteSettings/maintenanceExperience"), {version: "redesigned"}); });
  assert.equal((await tasks({action: "get", id: taskId})).task.description, "Fix the cooker");
});
