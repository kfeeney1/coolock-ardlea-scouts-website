import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const rebuild = readFileSync("scripts/rebuild-public-leadership.mjs", "utf8");
const verify = readFileSync("scripts/verify-public-leadership.mjs", "utf8");
const reconcile = readFileSync("scripts/reconcile-leadership-provenance.mjs", "utf8");
const deploy = readFileSync(".github/workflows/firebase-hosting-merge.yml", "utf8");
const seedWorkflow = readFileSync(".github/workflows/firebase-seed-test-data.yml", "utf8");

test("public leadership requires current canonical seed or approved registration provenance", () => {
  assert.match(rebuild, /isApprovedManualRegistration/);
  assert.match(rebuild, /leaderRegistrationRequests/);
  assert.doesNotMatch(rebuild, /approvedBy\) \|\| text\(access\.updatedBy/);
  assert.match(rebuild, /excludedUnprovenanced/);
});

test("public leadership verifier enforces the same provenance and approved section roles", () => {
  assert.match(verify, /isApprovedManualRegistration/);
  assert.match(verify, /leaderRegistrationRequests/);
  assert.match(verify, /SECTION_ROLES/);
  assert.doesNotMatch(verify, /if \(YOUTH_SECTIONS\.has\(sectionKey\)\) return Boolean\(text\(role\)\)/);
});

test("leadership cleanup remains explicit and canonical seed restoration is manual-only", () => {
  assert.match(reconcile, /isApprovedManualRegistration/);
  assert.match(reconcile, /batch\.delete\(db\.collection\("organisationLeadership"\)/);
  assert.doesNotMatch(deploy, /Restore canonical comprehensive seed population/);
  assert.doesNotMatch(deploy, /Remove leadership outside canonical seed or approved registrations/);
  assert.match(seedWorkflow, /workflow_dispatch/);
  assert.match(seedWorkflow, /confirm:/);
  assert.match(seedWorkflow, /Seed comprehensive population/);
  assert.match(seedWorkflow, /Rebuild public leadership projection from seeded database records/);
});
