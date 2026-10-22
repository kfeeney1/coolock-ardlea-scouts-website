import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { rulesCompilerReason } from "../../scripts/publish-test-rules.mjs";

test("collection-only helpers do not multiply into every Firestore match scope", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const rootHelpers = [...rules.matchAll(/^    function (\w+)\(/gm)].map((match) => match[1]);
  // Leave headroom above the 52 shared helpers after the scope-only refactor.
  assert.ok(rootHelpers.length <= 60, `${rootHelpers.length} root helpers; localize collection-specific functions`);
  for (const name of ["weeklyMeetingHasPresentMember", "validMaintenanceTask", "validMaintenanceDocument", "validPollDocument", "canReadPolicyAudience", "canManageJoinSection"]) {
    assert.ok(!rootHelpers.includes(name), `${name} belongs in its consuming match`);
    assert.match(rules, new RegExp(`^      function ${name}\\(`, "m"));
  }
});

test("compiler-limit diagnostics classify known failures without leaking messages", () => {
  assert.equal(rulesCompilerReason(new Error("SECRET: total size of compiled executables must be smaller than 256000")), "compiled Rules size limit exceeded");
  assert.equal(rulesCompilerReason(new Error("compiler recursion stack memory exhausted SECRET")), "Rules compiler stack limit exceeded");
  for (const message of ["SECRET", "permission denied", "invalid argument", "HTTP 400"]) {
    assert.equal(rulesCompilerReason(new Error(message)), "no recognised compiler-limit detail");
  }
});
