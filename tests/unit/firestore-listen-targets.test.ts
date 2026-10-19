import assert from "node:assert/strict";
import { test } from "node:test";
import { FirestoreListenTargets } from "../../e2e/support/firestore-listen-targets.ts";

const database = "projects/demo-coolock-ardlea-scouts/databases/(default)";
const target = (targetId: number, audienceType: string, db = database) => ({
  database: db,
  addTarget: { targetId, query: { parent: `${db}/documents`, structuredQuery: {
    from: [{ allDescendants: true, collectionId: "audienceSections" }],
    orderBy: [{ direction: "ASCENDING", field: { fieldPath: "__name__" } }],
    where: { fieldFilter: { field: { fieldPath: "audienceType" }, op: "EQUAL", value: { stringValue: audienceType } } }
  } } }
});
const envelope = (...messages: unknown[]) => new URLSearchParams({ count: String(messages.length), ofs: "0", ...Object.fromEntries(messages.map((message, index) => [`req${index}___data__`, JSON.stringify(message)])) }).toString();

test("observed 1014/1016 transport replay remains exactly two logical targets", () => {
  const capture = new FirestoreListenTargets("audienceSections");
  const body = envelope(target(1014, "leaders"), target(1016, "parents"));
  capture.record(body); capture.record(body);
  assert.deepEqual(capture.values().map(target => target.targetId), [1014, 1016]);
});
test("replay inside a batched envelope also counts once", () => {
  const capture = new FirestoreListenTargets("audienceSections");
  capture.record(envelope(target(1014, "leaders"), target(1016, "parents"), target(1014, "leaders"), target(1016, "parents")));
  assert.equal(capture.values().length, 2);
});
test("an additional distinct target remains observable even for an identical query", () => {
  const capture = new FirestoreListenTargets("audienceSections");
  capture.record(envelope(target(1014, "leaders"), target(1016, "parents"), target(1018, "leaders")));
  assert.equal(capture.values().length, 3);
});
test("conflicting query reuse cannot be hidden as replay", () => {
  const capture = new FirestoreListenTargets("audienceSections");
  capture.record(envelope(target(1014, "leaders")));
  assert.throws(() => capture.record(envelope(target(1014, "parents"))), /Query changed for existing Firestore target 1014/);
});
test("target IDs belong to their database rather than a global identity", () => {
  const capture = new FirestoreListenTargets("audienceSections");
  capture.record(envelope(target(1014, "leaders"), target(1014, "leaders", "projects/other/databases/(default)")));
  assert.equal(capture.values().length, 2);
});
test("control fields and unrelated document reads do not become discovery queries", () => {
  const capture = new FirestoreListenTargets("audienceSections");
  capture.record(null);
  capture.record(envelope({ database, addTarget: { targetId: 2, documents: { documents: [`${database}/documents/adminUsers/leader`] } } }));
  assert.deepEqual(capture.values(), []);
});
