import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
let env;
before(async () => { env = await initializeTestEnvironment({projectId: "demo-coolock-ardlea-scouts", firestore: {host: "127.0.0.1", port: 8080, rules: await readFile("firestore.rules", "utf8")}}); });
after(async () => env?.cleanup());
test("maintenance cannot bypass the validating backend even through direct document IDs", async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await assertSucceeds(setDoc(doc(ctx.firestore(), "maintenance/group/documents/example"), {state: "ready"}));
    await setDoc(doc(ctx.firestore(), "adminUsers/maintenance-super"), {active: true, role: "super-admin", sections: ["Group"]});
  });
  for (const ctx of [env.unauthenticatedContext(), env.authenticatedContext("maintenance-outsider"), env.authenticatedContext("maintenance-super")]) {
    for (const path of ["maintenance/group/documents/example", "maintenance/group/tasks/example", "maintenance/other-group/documents/example"]) {
      await assertFails(getDoc(doc(ctx.firestore(), path)));
      await assertFails(setDoc(doc(ctx.firestore(), path), {state: "ready"}));
    }
  }
});

test("direct SDK membership references cannot grant or retain authority independently of canonical records", async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "siteSettings/maintenanceExperience"), {version: "redesigned", sdkRevision: 1});
    await setDoc(doc(db, "parentAccounts/maintenance-parent"), {status: "approved"});
    await setDoc(doc(db, "members/maintenance-linked-record"), {accountUid: "maintenance-linked", status: "active"});
    await setDoc(doc(db, "members/maintenance-other-record"), {accountUid: "maintenance-other", status: "active"});
  });
  for (const [uid, kind, sourceId] of [["maintenance-super", "leader", "maintenance-super"], ["maintenance-parent", "parent", "maintenance-parent"], ["maintenance-linked", "member", "maintenance-linked-record"]]) {
    const db = env.authenticatedContext(uid).firestore();
    await assertSucceeds(setDoc(doc(db, `maintenance/group/access/${uid}`), {kind, sourceId}));
    await assertFails(setDoc(doc(db, "maintenance/group/access/another-user"), {kind, sourceId}));
    await assertFails(setDoc(doc(db, `maintenance/group/access/${uid}`), {kind, sourceId, granted: true}));
  }
  const outsider = env.authenticatedContext("maintenance-outsider").firestore();
  for (const data of [{kind: "leader", sourceId: "maintenance-super"}, {kind: "member", sourceId: "maintenance-other-record"}]) {
    await assertFails(setDoc(doc(outsider, "maintenance/group/access/maintenance-outsider"), data));
  }
  const linked = env.authenticatedContext("maintenance-linked").firestore();
  await assertSucceeds(getDoc(doc(linked, "members/maintenance-linked-record")));
  await assertSucceeds(getDocs(query(collection(linked, "members"), where("accountUid", "==", "maintenance-linked"), where("status", "==", "active"), limit(1))));
  await assertFails(getDocs(collection(linked, "members")));
  await assertFails(getDoc(doc(linked, "members/maintenance-other-record")));
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), "members/maintenance-linked-record"), {accountUid: "maintenance-linked", status: "inactive"});
  });
  await assertFails(setDoc(doc(linked, "maintenance/group/access/maintenance-linked"), {kind: "member", sourceId: "maintenance-linked-record"}));
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), "siteSettings/maintenanceExperience"), {version: "existing"}); });
  await assertFails(setDoc(doc(env.authenticatedContext("maintenance-super").firestore(), "maintenance/group/access/maintenance-super"), {kind: "leader", sourceId: "maintenance-super"}));
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), "siteSettings/maintenanceExperience"), {version: "redesigned"}); });
  await assertFails(setDoc(doc(env.authenticatedContext("maintenance-super").firestore(), "maintenance/group/access/maintenance-super"), {kind: "leader", sourceId: "maintenance-super"}));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), "maintenance/group/access/anonymous"), {kind: "member", sourceId: "maintenance-linked-record"}));
});
