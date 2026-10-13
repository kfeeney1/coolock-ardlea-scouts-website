import assert from "node:assert/strict";
import test from "node:test";
import { usesDirectEventPersistence } from "../../src/services/eventPersistenceMode.ts";

test("TEST saves directly without email or Functions", () => {
  assert.equal(usesDirectEventPersistence("test", "coolock-ardlea-scouts-test"), true);
});
test("TEST cannot use Production Firestore", () => {
  assert.throws(() => usesDirectEventPersistence("test", "coolock-ardlea-scouts"), /isolated TEST/);
});
test("Production and local retain their backend", () => {
  assert.equal(usesDirectEventPersistence("production", "coolock-ardlea-scouts"), false);
  assert.equal(usesDirectEventPersistence("local", "demo-coolock-ardlea-scouts"), false);
});
