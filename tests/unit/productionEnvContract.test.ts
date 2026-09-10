import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const baseEnv = {
  ...process.env,
  VITE_FIREBASE_API_KEY: "test-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "coolock-ardlea-scouts.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "coolock-ardlea-scouts",
  VITE_FIREBASE_STORAGE_BUCKET: "coolock-ardlea-scouts.firebasestorage.app",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "123456789",
  VITE_FIREBASE_APP_ID: "1:123456789:web:test"
};

function runProductionEnvCheck(emailApiUrl: string) {
  return spawnSync(process.execPath, ["scripts/check-production-env.mjs"], {
    cwd: process.cwd(),
    env: { ...baseEnv, VITE_EMAIL_API_URL: emailApiUrl },
    encoding: "utf8"
  });
}

test("production environment permits email to remain deferred", () => {
  const result = runProductionEnvCheck("");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /email endpoint is not configured/i);
});

test("production environment rejects an insecure configured email endpoint", () => {
  const result = runProductionEnvCheck("http://email.example.test");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /valid HTTPS URL when configured/i);
});

test("production environment accepts a configured HTTPS email endpoint", () => {
  const result = runProductionEnvCheck("https://email.example.test");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /email endpoint is configured and valid/i);
});
