import test from "node:test";
import assert from "node:assert/strict";
import { hallFirestore } from "../src/hallFirestore.js";
const env = {FIREBASE_PROJECT_ID: "demo-coolock-ardlea-scouts"};
function provider(failure) {
  const begins = [], writes = [], rollbacks = [];
  let attempts = 0;
  return {begins, writes, rollbacks, fetch: async (url, request) => {
    const body = JSON.parse(request.body);
    if (url.endsWith(":beginTransaction")) {begins.push(body); attempts++; return Response.json({transaction: `transaction-${attempts}`});}
    if (url.endsWith(":rollback")) {rollbacks.push(body.transaction); return Response.json({});}
    if (url.endsWith(":commit")) {writes.push(body); if (failure === "NETWORK") throw new TypeError("Connection lost after sending commit"); if (attempts === 1 || failure === "ALWAYS_ABORTED") return Response.json({error: {status: failure === "ALWAYS_ABORTED" ? "ABORTED" : failure}}, {status: failure === "UNAVAILABLE" ? 503 : 409}); return Response.json({});}
    if (url.endsWith(":batchGet")) return Response.json(body.documents.map(name => ({found: {name, fields: {revision: {integerValue: String(attempts)}}}})));
    throw new Error("Unexpected provider call");
  }};
}
test("confirmed abort re-runs the whole callback with fresh reads and priority", async () => {
  const transport = provider("ABORTED"), store = hallFirestore(env, "service", transport.fetch);
  const revisions = [];
  const result = await store.transaction(async tx => {const [current] = await tx.read(["hall/group"]); revisions.push(current.revision); tx.set("hall/group", {revision: current.revision + 1}); return current.revision;});
  assert.equal(result, 2); assert.deepEqual(revisions, [1, 2]);
  assert.deepEqual(transport.begins[1], {options: {readWrite: {retryTransaction: "transaction-1"}}});
  assert.deepEqual(transport.rollbacks, ["transaction-1"]);
  assert.equal(transport.writes[1].writes[0].update.fields.revision.integerValue, "3");
});
test("ambiguous outcomes and audit preconditions never replay a write", async () => {
  for (const failure of ["ALREADY_EXISTS", "UNAVAILABLE", "UNKNOWN", "NETWORK"]) {
    const transport = provider(failure), store = hallFirestore(env, "service", transport.fetch); let callbacks = 0;
    await assert.rejects(store.transaction(async tx => {callbacks++; tx.create("auditLog/hall-one-1", {actorUid: "council"});}));
    assert.equal(callbacks, 1); assert.equal(transport.writes.length, 1); assert.equal(transport.begins.length, 1);
  }
});
test("contention recovery is bounded and callback permission/conflict failures stop immediately", async () => {
  const transport = provider("ALWAYS_ABORTED"), store = hallFirestore(env, "service", transport.fetch);
  await assert.rejects(store.transaction(async tx => {tx.set("hall/group", {revision: 1});}), {status: 409});
  assert.equal(transport.begins.length, 5); assert.equal(transport.rollbacks.length, 5);
  const second = provider("ABORTED"), retryStore = hallFirestore(env, "service", second.fetch); let callbacks = 0;
  await assert.rejects(retryStore.transaction(async tx => {callbacks++; if (callbacks === 2) throw new Error("Council membership revoked"); tx.set("hall/group", {revision: 1});}), /membership revoked/);
  assert.equal(second.writes.length, 1); assert.equal(callbacks, 2);
});
