import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const rebuild = readFileSync("scripts/rebuild-public-leadership.mjs", "utf8");
const verify = readFileSync("scripts/verify-public-leadership.mjs", "utf8");

test("public leadership rebuild requires canonical seed or explicit manual provenance", () => {
  assert.match(rebuild, /hasPublishableProvenance\(source, access\)/);
  assert.match(rebuild, /approvedBy/);
  assert.match(rebuild, /updatedBy/);
  assert.match(rebuild, /excludedUnprovenanced/);
});

test("public leadership verifier enforces provenance and approved section roles", () => {
  assert.match(verify, /hasPublishableProvenance\(source, access\)/);
  assert.match(verify, /SECTION_ROLES/);
  assert.doesNotMatch(verify, /if \(YOUTH_SECTIONS\.has\(sectionKey\)\) return Boolean\(text\(role\)\)/);
});
