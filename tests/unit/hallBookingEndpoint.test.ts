import test from "node:test";
import assert from "node:assert/strict";
import {hallBookingEndpoint} from "../../src/services/hallBookingEndpoint.ts";
const testEnvironment = {appEnv: "test", firebaseProjectId: "coolock-ardlea-scouts-test", emailApiUrl: "https://production.invalid", hallApiUrl: "https://coolock-ardlea-scouts-hall-test.synthetic.workers.dev/"};
test("TEST booking transport is independent of disabled email and cannot fall back to Production", () => {
  assert.equal(hallBookingEndpoint({...testEnvironment, emailApiUrl: ""}), "https://coolock-ardlea-scouts-hall-test.synthetic.workers.dev/hall-bookings");
  assert.equal(hallBookingEndpoint({...testEnvironment, hallApiUrl: ""}), "");
  assert.throws(() => hallBookingEndpoint({...testEnvironment, firebaseProjectId: "coolock-ardlea-scouts"}));
  for (const appEnv of ["production", "local", undefined]) assert.throws(() => hallBookingEndpoint({...testEnvironment, appEnv}));
});
test("TEST rejects alternate projects, email Worker names, arbitrary origins, paths, credentials and insecure transports", () => {
  for (const hallApiUrl of ["https://production.invalid", "http://coolock-ardlea-scouts-hall-test.synthetic.workers.dev", "https://coolock-ardlea-scouts-email.synthetic.workers.dev", "https://coolock-ardlea-scouts-hall-test.synthetic.workers.dev/private", "https://user:secret@coolock-ardlea-scouts-hall-test.synthetic.workers.dev", "https://coolock-ardlea-scouts-hall-test.synthetic.workers.dev?project=production"]) assert.throws(() => hallBookingEndpoint({...testEnvironment, hallApiUrl}));
});
test("Production/local retain their existing Worker path and ignore TEST transport configuration", () => {
  assert.equal(hallBookingEndpoint({...testEnvironment, appEnv: "production", firebaseProjectId: "coolock-ardlea-scouts"}), "https://production.invalid/hall-bookings");
  assert.equal(hallBookingEndpoint({appEnv: "local", emailApiUrl: "http://127.0.0.1:8787/"}), "http://127.0.0.1:8787/hall-bookings");
  assert.equal(hallBookingEndpoint({appEnv: "production"}), "");
});
