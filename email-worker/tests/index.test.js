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

test("Join application email CTA links to the exact application record", async (t) => {
  const previousFetch = globalThis.fetch;
  let sentEmail;
  globalThis.fetch = async (_url, options) => {
    sentEmail = JSON.parse(options.body);
    return new Response("{}", { status: 200 });
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const response = await worker.fetch(request("/join-application", {
    body: JSON.stringify({ applicationId: "application/42", childName: "Synthetic Applicant" })
  }), { ...env, ADMIN_EMAILS: "admin@example.test", RESEND_API_KEY: "test" });

  assert.equal(response.status, 200);
  assert.match(sentEmail.html, /href="https:\/\/coolock-ardlea-scouts\.web\.app\/leader\/join\/application%2F42"/);
});

test("leader and parent access notifications link to their matching request records", async (t) => {
  const previousFetch = globalThis.fetch;
  const sentEmails = [];
  const registrationToken = (uid) => `header.${Buffer.from(JSON.stringify({ user_id: uid })).toString("base64url")}.signature`;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url === "https://api.resend.com/emails") {
      sentEmails.push(JSON.parse(options.body));
      return new Response("{}", { status: 200 });
    }
    if (url.endsWith("/documents/leaderRegistrationRequests/leader-request-42")) {
      return Response.json({ fields: { email: { stringValue: "leader@example.test" }, fullName: { stringValue: "Synthetic Leader" }, requestedSection: { stringValue: "Scouts" } } });
    }
    if (url.endsWith("/documents/parentAccounts/parent-request-42")) {
      return Response.json({ fields: { email: { stringValue: "parent@example.test" }, displayName: { stringValue: "Synthetic Parent" } } });
    }
    throw new Error(`Unexpected test fetch: ${url}`);
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const sharedEnv = { ...env, ADMIN_EMAILS: "admin@example.test", RESEND_API_KEY: "test" };
  const leaderResponse = await worker.fetch(request("/leader-registration", {
    headers: { Authorization: `Bearer ${registrationToken("leader-request-42")}` }
  }), sharedEnv);
  const parentResponse = await worker.fetch(request("/parent-registration", {
    headers: { Authorization: `Bearer ${registrationToken("parent-request-42")}` }
  }), sharedEnv);

  assert.equal(leaderResponse.status, 200);
  assert.equal(parentResponse.status, 200);
  assert.equal(sentEmails.length, 4);
  assert.match(sentEmails[1].html, /href="https:\/\/coolock-ardlea-scouts\.web\.app\/leader\/requests\?request=leader-request-42"/);
  assert.match(sentEmails[3].html, /href="https:\/\/coolock-ardlea-scouts\.web\.app\/leader\/parent-access\?parent=parent-request-42"/);
});

test("broken equipment email CTA links to the exact issue and item record", async (t) => {
  const previousFetch = globalThis.fetch;
  let sentEmail;
  const reporterToken = `header.${Buffer.from(JSON.stringify({ user_id: "test-reporter" })).toString("base64url")}.signature`;
  const firestoreRoot = "https://firestore.googleapis.com/v1/projects/coolock-ardlea-scouts/databases/(default)/documents";
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url === "https://api.resend.com/emails") {
      sentEmail = JSON.parse(options.body);
      return new Response("{}", { status: 200 });
    }
    if (url.includes("/documents/organisationLeadership")) {
      return Response.json({ documents: [{ name: `${firestoreRoot}/organisationLeadership/group-leader`, fields: { active: { booleanValue: true }, scoutingRole: { stringValue: "Group Leader" } } }] });
    }
    if (url.endsWith("/documents/adminUsers/test-reporter")) {
      return Response.json({ fields: { active: { booleanValue: true }, role: { stringValue: "leader" } } });
    }
    if (url.endsWith("/documents/adminUsers/group-leader")) {
      return Response.json({ fields: { active: { booleanValue: true }, email: { stringValue: "group-leader@example.test" } } });
    }
    if (url.endsWith("/documents/equipmentIncidents/incident-42")) {
      return Response.json({ fields: {
        reportedBy: { stringValue: "test-reporter" }, status: { stringValue: "reported" }, type: { stringValue: "damaged" },
        itemId: { stringValue: "tent-17" }, itemName: { stringValue: "Synthetic Patrol Tent" }, section: { stringValue: "Scouts" },
        itemLocation: { stringValue: "Main Store" }, description: { stringValue: "Synthetic broken zip report" }, quantity: { integerValue: "1" }
      } });
    }
    throw new Error(`Unexpected test fetch: ${url}`);
  };
  t.after(() => { globalThis.fetch = previousFetch; });

  const response = await worker.fetch(request("/equipment-incident", {
    headers: { Authorization: `Bearer ${reporterToken}` },
    body: JSON.stringify({ incidentId: "incident-42" })
  }), { ...env, RESEND_API_KEY: "test" });

  assert.equal(response.status, 200);
  assert.match(sentEmail.html, /href="https:\/\/coolock-ardlea-scouts\.web\.app\/leader\/equipment\/tent-17\?issue=incident-42"/);
});

test("authenticated leader endpoints reject missing bearer credentials before network access", async () => {
  const response = await worker.fetch(request("/leader-communication", {
    body: JSON.stringify({ subject: "Hello", message: "Message", memberIds: ["member-1"] })
  }), env);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { ok: false, error: "Active leader access required." });
});
