import assert from "node:assert/strict";
import { test } from "node:test";
import { applicationEnvironmentErrors } from "../../scripts/check-production-env.mjs";

const validEnvironment = {
  DEPLOY_ENVIRONMENT: "test",
  FIREBASE_PROJECT_ID: "coolock-ardlea-scouts-test",
  VITE_FIREBASE_API_KEY: "test-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "coolock-ardlea-scouts-test.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "coolock-ardlea-scouts-test",
  VITE_FIREBASE_STORAGE_BUCKET: "coolock-ardlea-scouts-test.firebasestorage.app",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  VITE_FIREBASE_APP_ID: "1:1234567890:web:test",
  VITE_EMAIL_API_URL: ""
};

test("TEST accepts empty email configuration", () => {
  assert.deepEqual(applicationEnvironmentErrors(validEnvironment), []);
});
test("TEST does not validate unused email settings", () => {
  assert.deepEqual(applicationEnvironmentErrors({ ...validEnvironment, VITE_EMAIL_API_URL: "http://unused.invalid" }), []);
});
test("TEST still rejects Production Firebase configuration", () => {
  assert.match(applicationEnvironmentErrors({ ...validEnvironment, VITE_FIREBASE_PROJECT_ID: "coolock-ardlea-scouts" }).join(" "), /deployment target/);
});
test("Production still requires the email backend", () => {
  assert.match(applicationEnvironmentErrors({ ...validEnvironment, DEPLOY_ENVIRONMENT: "production" }).join(" "), /VITE_EMAIL_API_URL/);
});
test("Production rejects an insecure email URL", () => {
  assert.match(applicationEnvironmentErrors({ ...validEnvironment, DEPLOY_ENVIRONMENT: "production", VITE_EMAIL_API_URL: "http://unused.invalid" }).join(" "), /HTTPS/);
});
