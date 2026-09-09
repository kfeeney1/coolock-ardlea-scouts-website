import assert from "node:assert/strict";
import test from "node:test";
import { effectivePermissionsFor, PERMISSION_REGISTRY } from "../../src/security/permissionRegistry.ts";

test("permission registry uses stable unique identifiers and enforcement locations", () => {
  const ids = PERMISSION_REGISTRY.map((permission) => permission.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(PERMISSION_REGISTRY.every((permission) => permission.enforcement.length > 0));
  assert.ok(PERMISSION_REGISTRY.every((permission) => permission.protected));
});

test("ordinary leader does not gain admin or group-wide appointment permissions", () => {
  const ids = new Set(effectivePermissionsFor("leader", "Scouter").map((permission) => permission.id));
  assert.ok(ids.has("members.read.section"));
  assert.ok(ids.has("members.write.section"));
  assert.equal(ids.has("roles.manage.admin"), false);
  assert.equal(ids.has("finance.manage.group"), false);
  assert.equal(ids.has("audit.read"), false);
});

test("Group Leader appointment adds operational permissions without admin promotion", () => {
  const ids = new Set(effectivePermissionsFor("leader", "Group Leader").map((permission) => permission.id));
  assert.ok(ids.has("members.read.group"));
  assert.ok(ids.has("badgework.manage.group"));
  assert.ok(ids.has("finance.manage.group"));
  assert.ok(ids.has("equipment.manage"));
  assert.ok(ids.has("audit.read"));
  assert.equal(ids.has("roles.manage.admin"), false);
});

test("only Super Admin receives admin promotion permission", () => {
  assert.equal(effectivePermissionsFor("admin", "").some((permission) => permission.id === "roles.manage.admin"), false);
  assert.equal(effectivePermissionsFor("super-admin", "").some((permission) => permission.id === "roles.manage.admin"), true);
});
