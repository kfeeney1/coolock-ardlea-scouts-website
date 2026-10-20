import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
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
