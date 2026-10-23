import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { rulesCompilerReason } from "../../scripts/publish-test-rules.mjs";

test("shared helpers are declared once and collection-only helpers stay local", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const rootHelpers = [...rules.matchAll(/^    function (\w+)\(/gm)].map((match) => match[1]);
  const helpers = [...rules.matchAll(/function (\w+)\(/g)].map((match) => match[1]);
  assert.equal(new Set(helpers).size, helpers.length, "share multi-consumer helper declarations instead of copying bodies");
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

test("local write validators receive incoming data and only guard create/update", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const validators = [...rules.matchAll(/^([ ]*)function (_validateWrite\d+)\(_writeData\) \{\n[ ]*return ([\s\S]*?);\n\1\}/gm)];
  assert.equal(validators.length, 53);
  for (const [, , name, expression] of validators) {
    assert.ok(expression.includes("_writeData"), name);
    assert.doesNotMatch(expression, /request\.resource\.data/);
    const calls = [...rules.matchAll(new RegExp(`allow ([^:]+): if ${name}\\(([^;]+)\\);`, "g"))];
    assert.equal(calls.length, 1, name);
    assert.ok(["create", "update", "create, update"].includes(calls[0][1]), name);
    assert.equal(calls[0][2], "request.resource.data", name);
  }
});
