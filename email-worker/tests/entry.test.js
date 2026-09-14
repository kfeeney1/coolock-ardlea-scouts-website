import assert from "node:assert/strict";
import test from "node:test";
import entry, { privacySafeDiagnostic, validateDeliveryEnvironment } from "../src/entry.js";

const production = {
  EMAIL_DELIVERY_MODE: "production",
  EMAIL_FROM: "80th 160th Coolock Ardlea Scout Group <noreply@coolockardleascouts.ie>",
  SITE_URL: "https://coolockardleascouts.ie",
  ALLOWED_ORIGINS: "https://coolockardleascouts.ie,https://www.coolockardleascouts.ie",
  TEST_EMAIL_REDIRECT: ""
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
    TEST_EMAIL_REDIRECT: "safe-test-inbox@example.com"
  }), "");
  assert.match(validateDeliveryEnvironment({ EMAIL_DELIVERY_MODE: "test" }), /TEST email requires/);
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
    "/member-inactivation"
  ]) {
    const response = await entry.fetch(productionRequest(path), production);
    assert.equal(response.status, 401, path);
    assert.deepEqual(await response.json(), { ok: false, error: "Sign-in required." }, path);
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
