import assert from "node:assert/strict";
import { test } from "node:test";
import { applicationEnvironmentErrors } from "../../scripts/check-production-env.mjs";

const validTestEnvironment = {
  FIREBASE_PROJECT_ID: "coolock-ardlea-scouts-test",
  VITE_FIREBASE_API_KEY: "test-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "coolock-ardlea-scouts-test.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "coolock-ardlea-scouts-test",
  VITE_FIREBASE_STORAGE_BUCKET: "coolock-ardlea-scouts-test.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  VITE_FIREBASE_APP_ID: "1:1234567890:web:test",
  VITE_EMAIL_API_URL: "https://coolock-ardlea-scouts-email-test.example.workers.dev",
};

test("application config rejects a missing event backend URL", () => {
  const environment = { ...validTestEnvironment, VITE_EMAIL_API_URL: "" };
  assert.match(applicationEnvironmentErrors(environment).join(" "), /VITE_EMAIL_API_URL/);
});

test("TEST application config accepts an HTTPS backend and TEST Firebase project", () => {
  assert.deepEqual(applicationEnvironmentErrors(validTestEnvironment), []);
});

test("TEST application config rejects the PRODUCTION Firebase project", () => {
  const environment = { ...validTestEnvironment, VITE_FIREBASE_PROJECT_ID: "coolock-ardlea-scouts" };
  assert.match(applicationEnvironmentErrors(environment).join(" "), /must equal the deployment target coolock-ardlea-scouts-test/);
});

test("application config rejects non-HTTPS event backend URLs", () => {
  const environment = { ...validTestEnvironment, VITE_EMAIL_API_URL: "http://coolock-ardlea-scouts-email-test.example.workers.dev" };
  assert.match(applicationEnvironmentErrors(environment).join(" "), /valid HTTPS URL/);
});
