import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

const env = {
  ALLOWED_ORIGINS: "https://coolock-ardlea-scouts.web.app",
  FIREBASE_PROJECT_ID: "coolock-ardlea-scouts",
  SITE_URL: "https://coolock-ardlea-scouts.web.app",
  ADMIN_EMAILS: ""
};

function request(path = "/unknown", options = {}) {
  return new Request(`https://email.example.test${path}`, {
    method: "POST",
    headers: {
      Origin: "https://coolock-ardlea-scouts.web.app",
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ?? "{}"
  });
}

test("OPTIONS returns the configured CORS origin", async () => {
  const response = await worker.fetch(new Request("https://email.example.test/join-application", {
    method: "OPTIONS",
    headers: { Origin: "https://coolock-ardlea-scouts.web.app" }
  }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://coolock-ardlea-scouts.web.app");
  assert.equal(response.headers.get("Vary"), "Origin");
});

test("rejects requests from an unapproved origin", async () => {
  const response = await worker.fetch(request("/join-application", {
    headers: { Origin: "https://attacker.example" }
  }), env);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { ok: false, error: "Origin not allowed." });
});

test("rejects non-POST methods", async () => {
  const response = await worker.fetch(new Request("https://email.example.test/join-application", {
    method: "GET",
    headers: { Origin: "https://coolock-ardlea-scouts.web.app" }
  }), env);
  assert.equal(response.status, 405);
});

test("rejects declared bodies over the worker limit", async () => {
  const response = await worker.fetch(request("/join-application", {
    headers: { "Content-Length": "20001" }
  }), env);
  assert.equal(response.status, 413);
});

test("rejects invalid JSON", async () => {
  const response = await worker.fetch(request("/join-application", { body: "{" }), env);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: "Invalid JSON." });
});

test("returns 404 for unknown worker routes", async () => {
  const response = await worker.fetch(request("/not-a-route"), env);
  assert.equal(response.status, 404);
});

test("join notifications fail closed when recipients are not configured", async () => {
  const response = await worker.fetch(request("/join-application", {
    body: JSON.stringify({ applicationId: "example-application" })
  }), env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: "Admin email recipients are not configured." });
});

test("authenticated leader endpoints reject missing bearer credentials before network access", async () => {
  const response = await worker.fetch(request("/leader-communication", {
    body: JSON.stringify({ subject: "Hello", message: "Message", memberIds: ["member-1"] })
  }), env);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { ok: false, error: "Active leader access required." });
});
