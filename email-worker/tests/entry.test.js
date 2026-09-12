import assert from "node:assert/strict";
import test from "node:test";
import { validateDeliveryEnvironment } from "../src/entry.js";

const production = {
  EMAIL_DELIVERY_MODE: "production",
  EMAIL_FROM: "80th 160th Coolock Ardlea Scout Group <noreply@coolockardleascouts.ie>",
  SITE_URL: "https://coolockardleascouts.ie",
  ALLOWED_ORIGINS: "https://coolockardleascouts.ie,https://www.coolockardleascouts.ie",
  TEST_EMAIL_REDIRECT: ""
};

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
