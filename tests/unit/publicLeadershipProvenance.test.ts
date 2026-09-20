import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const rebuild = readFileSync("scripts/rebuild-public-leadership.mjs", "utf8");
const verify = readFileSync("scripts/verify-public-leadership.mjs", "utf8");
const reconcile = readFileSync("scripts/reconcile-leadership-provenance.mjs", "utf8");
const deploy = readFileSync(".github/workflows/firebase-hosting-merge.yml", "utf8");
const playwright = readFileSync(".github/workflows/playwright-e2e.yml", "utf8");

test("public leadership rebuild follows explicit public opt-in and eligible appointments", () => {
  assert.match(rebuild, /source\.showPublicly !== true/);
  assert.match(rebuild, /access\.active !== true/);
  assert.match(rebuild, /publicAppointmentsFor/);
  assert.doesNotMatch(rebuild, /text\(access\.role\)\.toLowerCase\(\) !== "leader"/);
});

test("public leadership verifier enforces the same explicit opt-in and appointment projection", () => {
  assert.match(verify, /source\.showPublicly !== true/);
  assert.match(verify, /publicAppointmentsFor/);
  assert.match(verify, /SECTION_ROLES/);
  assert.match(verify, /sameAppointments/);
});

test("leadership cleanup remains explicit and canonical seed restoration stays non-production", () => {
  assert.match(reconcile, /isApprovedManualRegistration/);
  assert.match(reconcile, /batch\.delete\(db\.collection\("organisationLeadership"\)/);
  assert.doesNotMatch(deploy, /Restore canonical comprehensive seed population/);
  assert.doesNotMatch(deploy, /Remove leadership outside canonical seed or approved registrations/);
  assert.match(playwright, /Seed canonical deterministic E2E dataset/);
  assert.match(playwright, /FIRESTORE_EMULATOR_HOST/);
  assert.match(playwright, /FIREBASE_AUTH_EMULATOR_HOST/);
});
