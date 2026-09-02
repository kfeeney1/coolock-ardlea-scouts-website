import assert from "node:assert/strict";
import test from "node:test";
import { validateBuildInfo } from "../../scripts/check-live-build-info.mjs";

const now = Date.parse("2026-09-02T14:30:00.000Z");
const valid = {
  commit: "abc123",
  buildTime: "2026-09-02T14:25:00.000Z",
  source: "github-actions",
};

test("accepts valid deployed GitHub build evidence", () => {
  assert.deepEqual(validateBuildInfo(valid, { expectedBuildSha: "abc123", now }), []);
});

test("rejects a deployed commit that differs from the expected release", () => {
  assert.match(validateBuildInfo(valid, { expectedBuildSha: "def456", now }).join("\n"), /does not match expected def456/);
});

test("rejects malformed, future, or non-CI release evidence", () => {
  assert.ok(validateBuildInfo(null, { now }).length > 0);
  assert.match(validateBuildInfo({ ...valid, buildTime: "not-a-date" }, { now }).join("\n"), /invalid buildTime/);
  assert.match(validateBuildInfo({ ...valid, buildTime: "2026-09-02T15:00:00.000Z" }, { now }).join("\n"), /future/);
  assert.match(validateBuildInfo({ ...valid, source: "local" }, { expectedBuildSha: "abc123", now }).join("\n"), /github-actions/);
});
