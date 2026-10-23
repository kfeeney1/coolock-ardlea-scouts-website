import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { rulesCompilerReason } from "../../scripts/publish-test-rules.mjs";

test("collection-only helpers do not multiply into every Firestore match scope", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const rootHelpers = [...rules.matchAll(/^    function (\w+)\(/gm)].map((match) => match[1]);
  // Only broadly shared identity/section helpers belong in the database root.
  assert.ok(rootHelpers.length <= 14, `${rootHelpers.length} root helpers; localize collection-specific functions`);
  for (const name of ["weeklyMeetingHasPresentMember", "validMaintenanceTask", "validMaintenanceDocument", "validPollDocument", "canReadPolicyAudience", "canManageJoinSection", "validMaintenanceSource", "validIsoDate", "hasFinanceAppointment"]) {
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


test("shared leader checks expand canonical profile reads only once", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  for (const name of ["isCanonicalLeaderProfile", "profileHasSection"]) {
    const body = rules.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?^    \\}`, "m"))?.[0] ?? "";
    assert.equal([...body.matchAll(/profile\(\)/g)].length, 1, name);
  }
  const section = rules.match(/function hasSection\(section\) \{[\s\S]*?^    \}/m)?.[0] ?? "";
  assert.equal([...section.matchAll(/isActiveLeader\(\)/g)].length, 1);
  assert.doesNotMatch(section, /isAdmin\(/);
  const group = rules.match(/function isGroupLeader\(\) \{[\s\S]*?^    \}/m)?.[0] ?? "";
  assert.match(group, /isActiveLeader\(\)[\s\S]*exists\([\s\S]*activeGroupLeadership\(get\(/);
  assert.equal([...group.matchAll(/get\(/g)].length, 1);
});
