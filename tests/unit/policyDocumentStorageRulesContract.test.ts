import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rules = readFileSync(new URL("../../storage.rules", import.meta.url), "utf8");

test("policy writes are restricted to publication managers", () => {
  assert.match(rules, /function canManagePolicies\(\) \{ return isAdmin\(\) \|\| hasGroupLeadershipRole\(\); \}/);
  assert.match(rules, /allow create: if validPolicyWrite/);
  assert.match(rules, /allow delete: if canManagePolicies/);
  assert.match(rules, /allow update: if false/);
});

test("policy object reads validate metadata as well as path audience", () => {
  assert.match(rules, /resource\.metadata\.ownerType == "policy-document"/);
  assert.match(rules, /resource\.metadata\.audience == audience/);
  assert.match(rules, /resource\.metadata\.state == "current"/);
});
