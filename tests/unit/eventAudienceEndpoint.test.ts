import assert from "node:assert/strict";
import { test } from "node:test";
import { eventAudienceEndpoint } from "../../src/services/eventAudienceEndpoint.ts";

test("TEST event saves use Firebase Hosting without an email URL", () => {
  assert.equal(eventAudienceEndpoint({ appEnv: "test", firebaseProjectId: "coolock-ardlea-scouts-test" }), "/api/event-audience-save");
});
test("TEST ignores a configured Production email URL", () => {
  assert.equal(eventAudienceEndpoint({ appEnv: "test", firebaseProjectId: "coolock-ardlea-scouts-test", emailApiUrl: "https://production.invalid" }), "/api/event-audience-save");
});
test("TEST event saves reject a Production Firebase project", () => {
  assert.throws(() => eventAudienceEndpoint({ appEnv: "test", firebaseProjectId: "coolock-ardlea-scouts" }), /isolated TEST/);
});
test("Production event saves retain the authenticated Worker endpoint", () => {
  assert.equal(eventAudienceEndpoint({ appEnv: "production", emailApiUrl: "https://production.invalid/" }), "https://production.invalid/event-audience-save");
});
test("local emulator tests retain their local Worker endpoint", () => {
  assert.equal(eventAudienceEndpoint({ appEnv: "local", emailApiUrl: "http://127.0.0.1:8787" }), "http://127.0.0.1:8787/event-audience-save");
});
test("Production has no success fallback when its backend is missing", () => {
  assert.equal(eventAudienceEndpoint({ appEnv: "production" }), "");
});
