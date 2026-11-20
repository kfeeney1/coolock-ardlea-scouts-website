import test from "node:test";
import assert from "node:assert/strict";
import entry, {handleTestHallRequest, hallTestProject, hallTestOrigin} from "../src/testHallEntry.js";
const origin = "https://coolock-ardlea-scouts-test.web.app", commit = "a".repeat(40);
const env = {FIREBASE_PROJECT_ID: hallTestProject, HALL_BUILD_COMMIT: commit, FIREBASE_SERVICE_ACCOUNT_EMAIL: "test-account@coolock-ardlea-scouts-test.iam.gserviceaccount.com", FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: "synthetic-unused-key"};
const token = project => `header.${Buffer.from(JSON.stringify({sub: "leader", aud: project, iss: `https://securetoken.google.com/${project}`})).toString("base64url")}.signature`;
const request = (path, {method = "POST", headers = {}, body = '{"action":"list"}'} = {}) => new Request(`https://worker.invalid${path}`, {method, headers: {Origin: origin, ...headers}, ...(!["GET", "HEAD"].includes(method) ? {body} : {})});
test("TEST entry publishes only neutral exact-revision metadata and accepts only isolated TEST origins", async () => {
  const response = await entry.fetch(request("/health", {method: "GET"}), env, {waitUntil() {throw new Error("ExecutionContext is not a service token callback.");}});
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), {service: "hall-bookings-test", environment: "test", project: hallTestProject, commit}); assert.equal(response.headers.get("X-Hall-Backend-Commit"), commit);
  assert.equal(hallTestOrigin("https://coolock-ardlea-scouts-test--pr570-abc.web.app"), true);
  for (const value of ["https://coolockardleascouts.ie", "https://coolock-ardlea-scouts.web.app", "https://coolock-ardlea-scouts-test.web.app.evil.invalid", "http://coolock-ardlea-scouts-test.web.app", "https://user@coolock-ardlea-scouts-test.web.app"]) assert.equal(hallTestOrigin(value), false);
});
test("wrong projects, production credentials, emulator bindings and missing revision fail before network access", async () => {
  for (const change of [{FIREBASE_PROJECT_ID: "coolock-ardlea-scouts"}, {FIREBASE_SERVICE_ACCOUNT_EMAIL: "production@coolock-ardlea-scouts.iam.gserviceaccount.com"}, {FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080"}, {FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099"}, {HALL_BUILD_COMMIT: ""}]) {
    let calls = 0; const response = await handleTestHallRequest(request("/hall-bookings"), {...env, ...change}, async () => {calls++;}); assert.equal(response.status, 503); assert.equal(calls, 0);
  }
});
test("no email/programme/scheduler routes exist and no user input can select Production", async () => {
  let calls = 0;
  for (const path of ["/event-parent-notification", "/event-audience-save", "/join-application-status", "/scheduled"]) {
    const response = await handleTestHallRequest(request(path), env, async () => {calls++;}); assert.equal(response.status, 404);
  }
  assert.equal(calls, 0); assert.equal("scheduled" in entry, false);
  const denied = await handleTestHallRequest(request("/hall-bookings", {headers: {Origin: "https://coolockardleascouts.ie"}}), env, async () => {calls++;}); assert.equal(denied.status, 403); assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
});
test("missing/cross-project identities are rejected early; TEST hints never replace Firestore token verification", async () => {
  let calls = 0;
  for (const headers of [{}, {Authorization: `Bearer ${token("coolock-ardlea-scouts")}`}]) {
    const response = await handleTestHallRequest(request("/hall-bookings", {headers}), env, async () => {calls++;}); assert.equal(response.status, 401);
  }
  assert.equal(calls, 0);
  const response = await handleTestHallRequest(request("/hall-bookings", {headers: {Authorization: `Bearer ${token(hallTestProject)}`}}), env, async () => "synthetic-service-token", async (url, options) => {
    assert.equal(String(url).includes(`/projects/${hallTestProject}/`), true); assert.equal(options.headers.Authorization, `Bearer ${token(hallTestProject)}`);
    return Response.json({error: {status: "PERMISSION_DENIED", message: "PRIVATE provider body"}}, {status: 403});
  });
  assert.equal(response.status, 403); assert.equal((await response.text()).includes("PRIVATE"), false);
});
test("CORS preflight preserves the exact allowed origin without an email dependency", async () => {
  const response = await handleTestHallRequest(request("/hall-bookings", {method: "OPTIONS", body: ""}), env);
  assert.equal(response.status, 204); assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
});

test("isolated event discovery allows preflight and denies writes and foreign tokens before Firestore", async () => {
  const never = () => { throw new Error("Unexpected privileged read"); };
  const preflight = await handleTestHallRequest(request("/event-discovery", {method: "OPTIONS"}), env, never);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), origin);
  const write = await handleTestHallRequest(request("/event-discovery", {body: '{"operation":"create"}'}), env, never);
  assert.equal(write.status, 400);
  const foreign = await handleTestHallRequest(request("/event-discovery", {
    body: '{"operation":"read","collection":"events","filters":[]}',
    headers: {Authorization: `Bearer ${token("coolock-ardlea-scouts")}`}
  }), env, never);
  assert.equal(foreign.status, 401);
  const anonymous = await handleTestHallRequest(request("/event-discovery", {
    body: '{"operation":"read","collection":"events","filters":[]}'
  }), env, never);
  assert.equal(anonymous.status, 401);
});

test("TEST discovery returns public paths only after TEST Firestore authorizes them", async (t) => {
  const base = `https://firestore.googleapis.com/v1/projects/${hallTestProject}/databases/(default)/documents`;
  const prefix = `projects/${hallTestProject}/databases/(default)/documents/`;
  const publicEvent = {name: prefix + "publicEvents/visible", fields: {}};
  const source = {name: prefix + "events/visible", fields: {hidden: {booleanValue: false}}};
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const privileged = options.headers.Authorization === "Bearer synthetic-service-token";
    if (url === base + ":runQuery" && privileged) return Response.json([{document: publicEvent}]);
    assert.equal(url, base + ":batchGet");
    assert.deepEqual(JSON.parse(options.body).documents, [privileged ? source.name : publicEvent.name]);
    return Response.json([{found: privileged ? source : publicEvent}]);
  });
  const result = await handleTestHallRequest(request("/event-discovery", {
    body: '{"operation":"read","collection":"publicEvents","filters":[]}'
  }), env, async (configuration) => {
    assert.equal(configuration.FIREBASE_PROJECT_ID, hallTestProject);
    return "synthetic-service-token";
  });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), {ok: true, paths: ["publicEvents/visible"], cursor: null});
});
