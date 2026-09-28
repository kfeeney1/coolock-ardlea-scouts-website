import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("shared password field is masked by default and exposes accessible stateful actions", () => {
  const source = readFileSync("src/components/PasswordField.tsx", "utf8");
  assert.match(source, /useState\(false\)/);
  assert.match(source, /visible \? "text" : "password"/);
  assert.match(source, /"Hide password" : "Show password"/);
  assert.match(source, /aria-pressed=\{visible\}/);
  assert.match(source, /minWidth: 44, minHeight: 44/);
});

test("all user-facing password entry screens use the shared control", () => {
  for (const file of [
    "src/pages/AdminLogin.tsx",
    "src/pages/ParentPortal.tsx",
    "src/pages/ParentMemberInactivation.tsx",
    "src/pages/LeaderRegister.tsx",
    "src/pages/LeaderProfile.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /PasswordField/);
    assert.doesNotMatch(source, /type="password"/);
  }
});
