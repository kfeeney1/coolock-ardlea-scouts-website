import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-coolock-ardlea-scouts", firestore: { host: "127.0.0.1", port: 8080, rules: await readFile("firestore.rules", "utf8") } });
  await env.withSecurityRulesDisabled(async ctx => {
    for (const [uid, role] of [["maintenance-super", "super-admin"], ["maintenance-leader", "leader"]]) await setDoc(doc(ctx.firestore(), "adminUsers", uid), { active: true, role, sections: ["Group"] });
    await setDoc(doc(ctx.firestore(), "parentAccounts/maintenance-parent"), { status: "approved", memberIds: [], linkedSections: [] });
  });
});
after(async () => env?.cleanup());
test("only active Superusers can save Maintenance rollout; signed-in members can read its independent setting", async () => {
  const target = db => doc(db, "siteSettings/maintenanceExperience");
  for (const uid of ["maintenance-parent", "maintenance-leader", "maintenance-outsider"]) {
    const db = env.authenticatedContext(uid).firestore();
    await assertFails(setDoc(target(db), { version: "redesigned", sdkRevision: 1, updatedBy: uid, updatedAt: serverTimestamp() }));
  }
  const db = env.authenticatedContext("maintenance-super").firestore();
  await assertSucceeds(setDoc(target(db), { version: "redesigned", sdkRevision: 1, updatedBy: "maintenance-super", updatedAt: serverTimestamp() }));
  await assertFails(setDoc(target(db), { version: "invalid", sdkRevision: 1, updatedBy: "maintenance-super", updatedAt: serverTimestamp() }));
  await assertFails(setDoc(target(db), { version: "existing", sdkRevision: 1, updatedBy: "someone-else", updatedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(target(env.authenticatedContext("maintenance-parent").firestore())));
  await assertFails(getDoc(target(env.unauthenticatedContext().firestore())));
  for (const sdkRevision of [undefined, 0, 2, "1"]) {
    const data = {version: "redesigned", updatedBy: "maintenance-super", updatedAt: serverTimestamp()};
    if (sdkRevision !== undefined) data.sdkRevision = sdkRevision;
    await assertFails(setDoc(target(db), data));
  }
  await assertSucceeds(setDoc(target(db), {version: "existing", sdkRevision: 1, updatedBy: "maintenance-super", updatedAt: serverTimestamp()}));
});
