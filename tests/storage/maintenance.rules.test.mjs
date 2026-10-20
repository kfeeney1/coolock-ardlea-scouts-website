import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { ref, getBytes, uploadBytes } from "firebase/storage";
let env;
before(async () => { env = await initializeTestEnvironment({projectId: "demo-coolock-ardlea-scouts", storage: {host: "127.0.0.1", port: 9199, rules: await readFile("storage.rules", "utf8")}}); });
after(async () => env?.cleanup());
test("maintenance-documents bytes require the authenticated validating backend", async () => {
  await env.withSecurityRulesDisabled(async ctx => { await assertSucceeds(uploadBytes(ref(ctx.storage(), "maintenance-documents/example"), new Uint8Array([1]), {contentType: "application/pdf"})); });
  for (const ctx of [env.unauthenticatedContext(), env.authenticatedContext("maintenance-outsider"), env.authenticatedContext("maintenance-member")]) {
    await assertFails(getBytes(ref(ctx.storage(), "maintenance-documents/example")));
    await assertFails(uploadBytes(ref(ctx.storage(), "maintenance-documents/new"), new Uint8Array([1])));
  }
});
