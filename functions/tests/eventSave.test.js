import assert from "node:assert/strict";
import { test } from "node:test";
import { createEventSaveHandler, EVENT_BACKEND_PROJECT_ID } from "../src/handler.js";

function request(options = {}) {
  return new Request("https://test.invalid/api/event-audience-save", {
    method: options.method || "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.token === false ? {} : { Authorization: "Bearer test-id-token" }),
      ...(options.origin ? { Origin: options.origin } : {})
    },
    ...((options.method || "POST") === "POST" ? { body: JSON.stringify({ eventId: "event-1", operation: "create" }) } : {})
  });
}
function handler(overrides = {}) {
  return createEventSaveHandler({
    projectId: EVENT_BACKEND_PROJECT_ID,
    verifyIdToken: async () => ({ uid: "leader" }),
    getServiceAccessToken: async () => "runtime-access-token",
    saveAudience: async (_request, _environment, body) => Response.json({ ok: true, eventId: body.eventId }),
    ...overrides
  });
}
test("Firebase TEST event persistence requires no email settings or secrets", async () => {
  let invoked = false;
  const response = await handler({
    saveAudience: async (_request, env, body) => {
      invoked = true;
      assert.equal(env.FIREBASE_PROJECT_ID, EVENT_BACKEND_PROJECT_ID);
      assert.equal(env.EMAIL_DELIVERY_MODE, undefined);
      assert.equal(env.RESEND_API_KEY, undefined);
      assert.equal(env.TEST_EMAIL_REDIRECT, undefined);
      assert.equal(await env.getServiceAccessToken(), "runtime-access-token");
      return Response.json({ ok: true, eventId: body.eventId });
    }
  })(request());
  assert.equal(invoked, true);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, eventId: "event-1" });
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});
test("the TEST backend refuses to run in Production", async () => {
  let invoked = false;
  const response = await handler({ projectId: "coolock-ardlea-scouts", saveAudience: async () => { invoked = true; } })(request());
  assert.equal(response.status, 503);
  assert.equal(invoked, false);
});
test("unauthenticated saves are rejected before persistence", async () => {
  assert.equal((await handler()(request({ token: false }))).status, 401);
});
test("invalid or Production ID tokens cannot write TEST events", async () => {
  const response = await handler({ verifyIdToken: async () => { throw new Error("wrong audience"); } })(request());
  assert.equal(response.status, 401);
});
test("Production website origin is denied while TEST and preview origins work", async () => {
  assert.equal((await handler()(request({ origin: "https://coolockardleascouts.ie" }))).status, 403);
  assert.equal((await handler()(request({ origin: "https://coolock-ardlea-scouts-test.web.app" }))).status, 200);
  assert.equal((await handler()(request({ origin: "https://coolock-ardlea-scouts-test--pr-808-example.web.app" }))).status, 200);
});
test("a failed persistence operation never reports success", async () => {
  const response = await handler({ saveAudience: async () => { throw new Error("unavailable"); } })(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
});
test("the endpoint accepts only POST event writes", async () => {
  assert.equal((await handler()(request({ method: "GET" }))).status, 405);
});
