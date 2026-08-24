import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const rebuild = readFileSync("scripts/rebuild-public-leadership.mjs", "utf8");
const verify = readFileSync("scripts/verify-public-leadership.mjs", "utf8");
const reconcile = readFileSync("scripts/reconcile-leadership-provenance.mjs", "utf8");
const deploy = readFileSync(".github/workflows/firebase-hosting-merge.yml", "utf8");

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

test("live cleanup removes records outside seed or approved registration and restores seed first", () => {
  assert.match(reconcile, /isApprovedManualRegistration/);
  assert.match(reconcile, /batch\.delete\(db\.collection\("organisationLeadership"\)/);
  const seedIndex = deploy.indexOf("Restore canonical comprehensive seed population");
  const cleanupIndex = deploy.indexOf("Remove leadership outside canonical seed or approved registrations");
  assert.ok(seedIndex >= 0 && cleanupIndex > seedIndex, "canonical seed must be restored before legacy leadership cleanup");
});
