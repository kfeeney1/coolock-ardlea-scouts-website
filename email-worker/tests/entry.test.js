import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync } from "node:crypto";
import entry, { privacySafeDiagnostic, validateDeliveryEnvironment } from "../src/entry.js";
import { communicationIdempotencyKey, resolveJoinLeaderRecipients, resolveParentRecipientCandidates } from "../src/productionRoutes.js";
import { issueJoinConsentToken, issueMemberInactivationToken, verifyJoinConsentToken, verifyMemberInactivationToken } from "../src/secureActionLinks.js";

const production = {
  EMAIL_DELIVERY_MODE: "production",
  EMAIL_FROM: "80th 160th Coolock Ardlea Scout Group <noreply@coolockardleascouts.ie>",
  SITE_URL: "https://coolockardleascouts.ie",
  ALLOWED_ORIGINS: "https://coolockardleascouts.ie,https://www.coolockardleascouts.ie",
  TEST_EMAIL_REDIRECT: "",
  ACTION_LINK_SECRET: "test-action-link-secret-at-least-32-characters"
};

function productionRequest(path, body = {}) {
  return new Request(`https://email.example.test${path}`, {
    method: "POST",
    headers: {
      Origin: "https://coolockardleascouts.ie",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

test("production delivery requires the Scout domain and no test redirect", () => {
  assert.equal(validateDeliveryEnvironment(production), "");
  assert.match(validateDeliveryEnvironment({ ...production, TEST_EMAIL_REDIRECT: "test@example.com" }), /cannot use TEST_EMAIL_REDIRECT/);
  assert.match(validateDeliveryEnvironment({ ...production, EMAIL_FROM: "Scout Group <onboarding@resend.dev>" }), /Production EMAIL_FROM/);
  assert.match(validateDeliveryEnvironment({ ...production, SITE_URL: "https://coolock-ardlea-scouts.web.app" }), /Production SITE_URL/);
});

test("test delivery requires an explicit redirect recipient", () => {
  assert.equal(validateDeliveryEnvironment({
    EMAIL_DELIVERY_MODE: "test",
    TEST_EMAIL_REDIRECT: "safe-test-inbox@example.com",
    ACTION_LINK_SECRET: "test-action-link-secret-at-least-32-characters"
  }), "");
  assert.match(validateDeliveryEnvironment({ EMAIL_DELIVERY_MODE: "test", ACTION_LINK_SECRET: "test-action-link-secret-at-least-32-characters" }), /TEST email requires/);
});

test("ambiguous email environment fails closed", () => {
  assert.match(validateDeliveryEnvironment({}), /explicitly set/);
  assert.match(validateDeliveryEnvironment({ EMAIL_DELIVERY_MODE: "staging" }), /explicitly set/);
});

test("authoritative production communication routes require authentication before Firestore access", async () => {
  for (const path of [
    "/leader-communication",
    "/event-notification",
    "/event-consent-processed",
    "/form-reminder",
    "/member-inactivation-context",
    "/member-inactivation",
    "/join-application-status"
  ]) {
    const response = await entry.fetch(productionRequest(path), production);
    assert.equal(response.status, 401, path);
    assert.deepEqual(await response.json(), { ok: false, error: "Sign-in required." }, path);
  }
});

function firestoreLeadership(uid, appointments, active = true) {
  return {
    name: `projects/test/databases/(default)/documents/organisationLeadership/${uid}`,
    fields: {
      active: { booleanValue: true },
      appointments: { arrayValue: { values: appointments.map((item) => ({ mapValue: { fields: {
        appointment: { stringValue: item.role }, scope: { stringValue: item.scope }, active: { booleanValue: item.active ?? active }
      } } })) } }
    }
  };
}

function firestoreLeader(uid, email, active = true) {
  return { name: `projects/test/databases/(default)/documents/adminUsers/${uid}`, fields: { active: { booleanValue: active }, email: { stringValue: email } } };
}

test("SW-270 routes Join Us notifications to scoped Section Leaders and deduplicates recipients", () => {
  const profiles = [firestoreLeader("sl-1", "Leader@Example.com"), firestoreLeader("sl-2", "leader@example.com"), firestoreLeader("sl-other", "other@example.com")];
  const leadership = [
    firestoreLeadership("sl-1", [{ role: "Section Leader", scope: "Beavers" }]),
    firestoreLeadership("sl-2", [{ role: "Section Leader", scope: "Beavers" }]),
    firestoreLeadership("sl-other", [{ role: "Section Leader", scope: "Cubs" }])
  ];
  assert.deepEqual(resolveJoinLeaderRecipients(profiles, leadership, "Beavers"), ["leader@example.com"]);
});

test("SW-270 falls back to Group Leaders only when no active Section Leader matches", () => {
  const profiles = [firestoreLeader("inactive", "inactive@example.com", false), firestoreLeader("group", "group@example.com")];
  const leadership = [
    firestoreLeadership("inactive", [{ role: "Section Leader", scope: "Beavers" }]),
    firestoreLeadership("group", [{ role: "Group Leader", scope: "Group" }])
  ];
  assert.deepEqual(resolveJoinLeaderRecipients(profiles, leadership, "Beavers"), ["group@example.com"]);
});

test("SW-270 initial notices read authoritative data and repeated requests do not resend", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const ledger = new Map();
  const sent = [];
  let applicationStatus = "new";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "service-token", expires_in: 3600 });
    if (url.startsWith("https://firestore.googleapis.com/v1/projects/test-project/")) {
      if (url.includes("/joinApplications/app-1")) return Response.json({
        fields: {
          status: { stringValue: applicationStatus }, childFirstName: { stringValue: "Rory" }, childLastName: { stringValue: "Scout" },
          parentName: { stringValue: "Pat Parent" }, emailAddress: { stringValue: "parent@example.com" }, section: { stringValue: "Beavers" },
          memberId: { stringValue: "member-1" }
        }
      });
      if (url.includes("/adminUsers/leader-1")) return Response.json({ fields: {
        active: { booleanValue: true }, role: { stringValue: "leader" },
        sections: { arrayValue: { values: [{ stringValue: "Beavers" }] } }
      } });
      if (url.includes("/organisationLeadership/leader-1")) return new Response("", { status: 404 });
      if (url.includes("/parentAccounts/parent-1")) return Response.json({ fields: {
        status: { stringValue: "approved" }, email: { stringValue: "parent@example.com" },
        memberIds: { arrayValue: { values: [{ stringValue: "member-1" }] } }
      } });
      if (url.includes("/members/member-1")) return Response.json({ fields: { status: { stringValue: "active" } } });
      if (url.endsWith("/adminUsers?pageSize=100")) return Response.json({ documents: [{
        name: "projects/test-project/databases/(default)/documents/adminUsers/sl-1",
        fields: { active: { booleanValue: true }, email: { stringValue: "leader@example.com" } }
      }] });
      if (url.endsWith("/organisationLeadership?pageSize=100")) {
        const sectionLeader = { appointment: { stringValue: "Section Leader" }, scope: { stringValue: "Beavers" }, active: { booleanValue: true } };
        return Response.json({ documents: [{
          name: "projects/test-project/databases/(default)/documents/organisationLeadership/sl-1",
          fields: { active: { booleanValue: true }, appointments: { arrayValue: { values: [{ mapValue: { fields: sectionLeader } }] } } }
        }] });
      }
      if (url.includes("/joinApplicationEmailDeliveries/")) {
        const id = decodeURIComponent(url.split("/").pop());
        return ledger.has(id) ? Response.json(ledger.get(id)) : new Response("", { status: 404 });
      }
      if (url.endsWith("/documents:commit")) {
        const body = JSON.parse(init.body);
        for (const write of body.writes || []) {
          const id = write.update.name.split("/").pop();
          ledger.set(id, write.update);
        }
        return Response.json({});
      }
    }
    if (url === "https://api.resend.com/emails") {
      const body = JSON.parse(init.body);
      sent.push({ key: new Headers(init.headers).get("Idempotency-Key"), body });
      return Response.json({ id: `email-${sent.length}` });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  try {
    const env = {
      ...production, FIREBASE_PROJECT_ID: "test-project", FIREBASE_SERVICE_ACCOUNT_EMAIL: "service@test-project.iam.gserviceaccount.com",
      FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: privatePem, RESEND_API_KEY: "test-resend-key", ADMIN_EMAILS: ""
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await entry.fetch(productionRequest("/join-application", {
        applicationId: "app-1", childName: "forged name", section: "Cubs", parentName: "forged parent"
      }), env);
      assert.equal(response.status, 200, await response.text());
    }
    applicationStatus = "accepted";
    const token = `header.${btoa(JSON.stringify({ sub: "leader-1", user_id: "leader-1", email: "leader@example.com" })).replaceAll("=", "")}.signature`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const statusRequest = new Request("https://email.example.test/join-application-status", {
        method: "POST", headers: { Origin: "https://coolockardleascouts.ie", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ applicationId: "app-1", status: "accepted" })
      });
      const response = await entry.fetch(statusRequest, env);
      assert.equal(response.status, 200, await response.text());
    }
    assert.equal(sent.length, 3, "parent and section leader receive initial email once; accepted email is also sent once");
    assert.equal(sent[0].body.to[0], "parent@example.com");
    assert.match(sent[0].body.text, /Rory Scout/);
    assert.doesNotMatch(sent[0].body.text, /forged/);
    assert.equal(sent[1].body.to[0], "leader@example.com");
    assert.equal(sent[2].body.to[0], "parent@example.com");
    assert.match(sent[2].body.text, /complete the consent and medical form/);
    assert.match(sent[2].body.html, /https:\/\/coolockardleascouts\.ie\/parent\?joinToken=v1\.[^\"]+#parent-medical-consent/);
    assert.equal(new Set(sent.map((item) => item.key)).size, 3);
    const joinToken = sent[2].body.html.match(/joinToken=([^&#\"]+)/)?.[1];
    assert.ok(joinToken, "accepted email contains an opaque onboarding token");
    const parentToken = `header.${btoa(JSON.stringify({ sub: "parent-1", user_id: "parent-1", email: "parent@example.com" })).replaceAll("=", "")}.signature`;
    const consentRequest = new Request("https://email.example.test/join-consent-context", {
      method: "POST", headers: { Origin: "https://coolockardleascouts.ie", "Content-Type": "application/json", Authorization: `Bearer ${parentToken}` },
      body: JSON.stringify({ joinToken: decodeURIComponent(joinToken) })
    });
    const consentResponse = await entry.fetch(consentRequest, env);
    assert.deepEqual(await consentResponse.json(), { ok: true, memberId: "member-1" });

    const unrelatedToken = `header.${btoa(JSON.stringify({ sub: "other-parent", user_id: "other-parent", email: "other@example.com" })).replaceAll("=", "")}.signature`;
    const unrelatedRequest = new Request("https://email.example.test/join-consent-context", {
      method: "POST", headers: { Origin: "https://coolockardleascouts.ie", "Content-Type": "application/json", Authorization: `Bearer ${unrelatedToken}` },
      body: JSON.stringify({ joinToken: decodeURIComponent(joinToken) })
    });
    assert.equal((await entry.fetch(unrelatedRequest, env)).status, 403);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider diagnostics retain status but discard provider body and personal data", () => {
  const diagnostic = privacySafeDiagnostic([
    "Email worker error",
    new Error("Resend returned 422: {\"message\":\"recipient parent@example.com rejected for Child Name\",\"token\":\"secret-token\"}")
  ]);

  assert.deepEqual(diagnostic, {
    label: "Email worker error",
    detail: { code: "email-provider-error", providerStatus: 422 }
  });
  const serialized = JSON.stringify(diagnostic);
  assert.doesNotMatch(serialized, /parent@example\.com/);
  assert.doesNotMatch(serialized, /Child Name/);
  assert.doesNotMatch(serialized, /secret-token/);
});

test("non-provider diagnostics do not expose raw error messages", () => {
  const diagnostic = privacySafeDiagnostic(["Email worker error", new Error("Sensitive payload with api-key-123")]);
  assert.deepEqual(diagnostic, {
    label: "Email worker error",
    detail: { code: "email-worker-error" }
  });
  assert.doesNotMatch(JSON.stringify(diagnostic), /api-key-123/);
});


function firestoreParent(id, { status = "approved", memberIds = [], email = "", displayName = "Parent" } = {}) {
  return {
    name: `projects/test/databases/(default)/documents/parentAccounts/${id}`,
    fields: {
      status: { stringValue: status },
      memberIds: { arrayValue: { values: memberIds.map((value) => ({ stringValue: value })) } },
      email: { stringValue: email },
      displayName: { stringValue: displayName }
    }
  };
}

test("SW-117 resolves only approved parents explicitly linked to the selected member", () => {
  const accounts = [
    firestoreParent("parent-a", { memberIds: ["member-1"], email: "parent@example.com" }),
    firestoreParent("parent-b", { memberIds: ["member-2"], email: "unrelated@example.com" })
  ];
  const result = resolveParentRecipientCandidates(accounts, "member-1");
  assert.deepEqual(result.recipients.map((item) => item.email), ["parent@example.com"]);
  assert.equal(result.reason, "");
});

test("SW-117 deduplicates duplicate linked-parent paths by normalized email", () => {
  const accounts = [
    firestoreParent("parent-a", { memberIds: ["member-1"], email: "Parent@Example.com" }),
    firestoreParent("parent-b", { memberIds: ["member-1"], email: "parent@example.com" })
  ];
  const result = resolveParentRecipientCandidates(accounts, "member-1");
  assert.equal(result.recipients.length, 1);
  assert.equal(result.recipients[0].email, "parent@example.com");
});

test("SW-117 reports privacy-safe skip categories for inactive and invalid linked parents", () => {
  assert.equal(resolveParentRecipientCandidates([
    firestoreParent("parent-a", { status: "revoked", memberIds: ["member-1"], email: "parent@example.com" })
  ], "member-1").reason, "parent-inactive");
  assert.equal(resolveParentRecipientCandidates([
    firestoreParent("parent-a", { memberIds: ["member-1"], email: "not-an-email" })
  ], "member-1").reason, "email-missing-or-invalid");
  assert.equal(resolveParentRecipientCandidates([
    firestoreParent("parent-a", { memberIds: ["member-2"], email: "parent@example.com" })
  ], "member-1").reason, "no-eligible-linked-parent");
});


test("SW-117 resolves an approved parent linked through a sibling in the canonical family", () => {
  const accounts = [
    firestoreParent("parent-a", { memberIds: ["sibling-1"], email: "family@example.com" })
  ];
  const result = resolveParentRecipientCandidates(accounts, "member-1", ["member-1", "sibling-1"]);
  assert.deepEqual(result.recipients.map((item) => item.email), ["family@example.com"]);
  assert.equal(result.reason, "");
});

test("SW-117 canonical family fallback does not cross unrelated families", () => {
  const accounts = [
    firestoreParent("parent-a", { memberIds: ["unrelated-member"], email: "unrelated@example.com" })
  ];
  const result = resolveParentRecipientCandidates(accounts, "member-1", ["member-1", "sibling-1"]);
  assert.equal(result.recipients.length, 0);
  assert.equal(result.reason, "no-eligible-linked-parent");
});

test("SW-117 canonical family fallback preserves revoked, invalid-email and deduplication rules", () => {
  const accounts = [
    firestoreParent("revoked", { status: "revoked", memberIds: ["sibling-1"], email: "revoked@example.com" }),
    firestoreParent("parent-a", { memberIds: ["sibling-1"], email: "Family@Example.com" }),
    firestoreParent("parent-b", { memberIds: ["member-1"], email: "family@example.com" }),
    firestoreParent("invalid", { memberIds: ["sibling-1"], email: "not-an-email" })
  ];
  const result = resolveParentRecipientCandidates(accounts, "member-1", ["member-1", "sibling-1"]);
  assert.equal(result.recipients.length, 1);
  assert.equal(result.recipients[0].email, "family@example.com");
});

test("SW-117 supports two approved parents linked across the same canonical family", () => {
  const accounts = [
    firestoreParent("parent-a", { memberIds: ["member-1"], email: "first@example.com" }),
    firestoreParent("parent-b", { memberIds: ["sibling-1"], email: "second@example.com" })
  ];
  const result = resolveParentRecipientCandidates(accounts, "member-1", ["member-1", "sibling-1"]);
  assert.deepEqual(result.recipients.map((item) => item.email).sort(), ["first@example.com", "second@example.com"]);
});


test("SW-108 leader communication idempotency is stable for a retry and changes with message content", async () => {
  const first = await communicationIdempotencyKey("member-1", "parent-1", "Subject", "Message");
  const retry = await communicationIdempotencyKey("member-1", "parent-1", "Subject", "Message");
  const changed = await communicationIdempotencyKey("member-1", "parent-1", "Subject", "Different message");
  assert.equal(first, retry);
  assert.notEqual(first, changed);
  assert.match(first, /^leader-communication:[A-Za-z0-9_-]+$/);
});


test("SW-45 action tokens are opaque, purpose-bound and expire safely", async () => {
  const env = { ACTION_LINK_SECRET: "test-action-link-secret-at-least-32-characters" };
  const token = await issueMemberInactivationToken(env, "member-sensitive-id", 60);
  assert.doesNotMatch(token, /member-sensitive-id/);
  const verified = await verifyMemberInactivationToken(env, token);
  assert.equal(verified.memberId, "member-sensitive-id");
  assert.equal(verified.purpose, "member-inactivation");

  const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
  assert.equal(await verifyMemberInactivationToken(env, tampered), null);
  const expired = await issueMemberInactivationToken(env, "member-sensitive-id", -1);
  assert.equal(await verifyMemberInactivationToken(env, expired), null);
});

test("SW-270 consent tokens hide the application id and expire safely", async () => {
  const env = { ACTION_LINK_SECRET: "test-action-link-secret-at-least-32-characters" };
  const token = await issueJoinConsentToken(env, "application-sensitive-id", 60);
  assert.doesNotMatch(token, /application-sensitive-id/);
  assert.equal((await verifyJoinConsentToken(env, token)).applicationId, "application-sensitive-id");
  assert.equal(await verifyJoinConsentToken(env, await issueJoinConsentToken(env, "application-sensitive-id", -1)), null);
});

test("SW-45 production configuration fails closed without an action-link secret", () => {
  const { ACTION_LINK_SECRET: _removed, ...unsafe } = production;
  assert.match(validateDeliveryEnvironment(unsafe), /ACTION_LINK_SECRET/);
});
